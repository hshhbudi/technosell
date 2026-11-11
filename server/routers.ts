
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";

import {
  addCustomerBalance,
  claimFirstAdmin,
  createOrder,
  createProduct,
  deleteProduct,
  getSupplierProductById,
  grantAdminByEmail,
  listAllProducts,
listProducts,
  listApprovedSupplierProducts,
  listAllSupplierProducts,
  setSupplierProductApproval,
  setSupplierProductEnabled,
  setSupplierCategoryEnabled,
  listSupplierCategoryOverrides,
  saveSupplierCategoryOverride,
  listCustomerOrders,
  listOrders,
  spendCustomerBalance,
  transferOwnership,
  updateCustomerPassword,
  updateOrderStatus,
  updateProduct,
  updateSupplierOrder,
  createCustomer,
  getCustomerByEmail,
  getCustomerById,
} from "./db";

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { storagePut } from "./storage";
import { getFast4TopProfile, syncFast4TopCatalog } from "./fast4top";
import { dispatchFast4TopOrder } from "./fast4topWorker";
import {
  clearLocalAdmin,
  localAdminUser,
  signLocalAdmin,
} from "./_core/localAdmin";
import { verifyFirebaseIdToken } from "./_core/firebaseAdmin";

const CUSTOMER_COOKIE = "technosell_customer";

const customerSecret = () =>
  new TextEncoder().encode(
    ENV.cookieSecret || "technosell-development-secret"
  );

const hashPassword = (
  password: string,
  salt = randomBytes(16).toString("hex")
) =>
  `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const passwordMatches = (password: string, stored: string) => {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
};

const secretMatches = (provided: string, expected: string) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    a.length > 0 &&
    timingSafeEqual(a, b)
  );
};

const customerSafe = (
  customer: Awaited<ReturnType<typeof getCustomerById>>
) =>
  customer && {
    id: customer.id,
    displayName: customer.displayName,
    email: customer.email,
    phone: customer.phone,
    freeFireId: customer.freeFireId,
    pubgId: customer.pubgId,
    pubgServerId: customer.pubgServerId,
    takaId: customer.takaId,
    bigoId: customer.bigoId,
    balanceCents: customer.balanceCents,
  };

async function customerFromRequest(req: {
  headers: { cookie?: string };
}) {
  const token = parseCookie(req.headers.cookie ?? "")[
    CUSTOMER_COOKIE
  ];

  if (!token) return undefined;

  try {
    const { payload } = await jwtVerify(token, customerSecret());

    return typeof payload.sub === "string"
      ? getCustomerById(Number(payload.sub))
      : undefined;
  } catch {
    return undefined;
  }
}

async function setCustomerCookie(res: any, id: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(id))
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(customerSecret());

  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
}

async function savePaymentProof(data?: string) {
  if (!data) return null;

  const match = data.match(
    /^data:(image\/(?:png|jpe?g|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/
  );

  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ارفع صورة أو ملف PDF صالح لإثبات شام كاش",
    });
  }

  const uploaded = await storagePut(
    `payment-proofs/proof-${Date.now()}-${randomUUID()}`,
    Buffer.from(match[2], "base64"),
    match[1]
  );

  return uploaded.url;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);

      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });

      return {
        success: true,
      } as const;
    }),
  }),
  products: router({
    list: publicProcedure.query(() => listProducts()),
  }),
  adminLocal: router({
    me: publicProcedure.query(({ ctx }) =>
      ctx.user?.openId === "local-admin" ? ctx.user : null
    ),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (
          !ENV.localAdminEmail ||
          !ENV.localAdminPassword ||
          input.email.trim().toLowerCase() !== ENV.localAdminEmail ||
          !secretMatches(input.password, ENV.localAdminPassword)
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "البريد أو كلمة المرور غير صحيحة",
          });
        }

        await signLocalAdmin(ctx.res);
        return localAdminUser();
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearLocalAdmin(ctx.res);
      return { success: true } as const;
    }),
  }),

  customer: router({
    me: publicProcedure.query(async ({ ctx }) =>
      customerSafe(await customerFromRequest(ctx.req)) ?? null
    ),

    orders: publicProcedure.query(async ({ ctx }) => {
      const customer = await customerFromRequest(ctx.req);
      return customer ? listCustomerOrders(customer.id) : [];
    }),

    register: publicProcedure
      .input(
        z.object({
          displayName: z.string().min(2).max(120),
          email: z.string().email().max(320),
          password: z.string().min(8).max(200),
          phone: z.string().max(40).optional(),
          freeFireId: z.string().max(120).optional(),
          pubgId: z.string().max(120).optional(),
          pubgServerId: z.string().max(120).optional(),
          takaId: z.string().max(120).optional(),
          bigoId: z.string().max(120).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (await getCustomerByEmail(input.email)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا البريد مسجل مسبقًا",
          });
        }

        const { password, ...profile } = input;

        const customer = await createCustomer({
          ...profile,
          email: input.email.toLowerCase(),
          passwordHash: hashPassword(password),
          phone: input.phone || null,
          freeFireId: input.freeFireId || null,
          pubgId: input.pubgId || null,
          pubgServerId: input.pubgServerId || null,
          takaId: input.takaId || null,
          bigoId: input.bigoId || null,
        });

        await setCustomerCookie(ctx.res, customer.id);

        return customerSafe(customer);
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const customer = await getCustomerByEmail(input.email);

        if (
          !customer ||
          !passwordMatches(input.password, customer.passwordHash)
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "البريد أو كلمة المرور غير صحيحة",
          });
        }

        await setCustomerCookie(ctx.res, customer.id);

        return customerSafe(customer);
      }),

    firebaseLogin: publicProcedure
      .input(
        z.object({
          idToken: z.string().min(20).max(10_000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let decoded;

        try {
          decoded = await verifyFirebaseIdToken(input.idToken);
        } catch {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "تعذر التحقق من حساب Firebase",
          });
        }

        const email = decoded.email?.trim().toLowerCase();

        if (!email) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "حساب Firebase لا يحتوي على بريد إلكتروني",
          });
        }

        let customer = await getCustomerByEmail(email);

        if (!customer) {
          customer = await createCustomer({
            displayName:
              decoded.name || email.split("@")[0] || "عميل Techno Sell",
            email,
            passwordHash: hashPassword(randomBytes(32).toString("hex")),
            phone: null,
            freeFireId: null,
            pubgId: null,
            pubgServerId: null,
            takaId: null,
            bigoId: null,
            balanceCents: 0,
          });
        }

        await setCustomerCookie(ctx.res, customer.id);

        return customerSafe(customer);
      }),

    changePassword: publicProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const customer = await customerFromRequest(ctx.req);

        if (
          !customer ||
          !passwordMatches(input.currentPassword, customer.passwordHash)
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "كلمة المرور الحالية غير صحيحة",
          });
        }

        await updateCustomerPassword(
          customer.id,
          hashPassword(input.newPassword)
        );

        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(CUSTOMER_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      return { success: true };
    }),

    requestWalletTopup: publicProcedure
      .input(
        z.object({
          amountCents: z.number().int().positive().max(10_000_000),
          paymentReference: z.string().max(160).optional(),
          paymentProofData: z.string().max(8_000_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const customer = await customerFromRequest(ctx.req);

        if (!customer) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "سجّل دخولك أولًا لطلب تعبئة الرصيد",
          });
        }

        const paymentProofUrl = await savePaymentProof(
          input.paymentProofData
        );

        return createOrder({
          customerId: customer.id,
          orderNumber: `TS-W-${Date.now().toString().slice(-8)}`,
          items: JSON.stringify([
            {
              id: 0,
              name: "تعبئة رصيد الحساب",
              category: "تعبئة الرصيد",
              price: input.amountCents,
              digital: true,
            },
          ]),
          total: input.amountCents,
          customerName: customer.displayName,
          phone: customer.phone || "غير مضاف",
          paymentMethod: "shamcash",
          paymentReference: input.paymentReference || null,
          paymentProofUrl,
        });
      }),

    directTopup: publicProcedure
      .input(
        z.object({
          supplierProductId: z.number().int().positive(),
          name: z.string().max(180),
          category: z.string().max(80),
          targetId: z.string().max(160).optional(),
          quantity: z.number().int().positive().max(100_000_000).optional(),
          totalCents: z.number().int().positive().max(10_000_000),
          paymentReference: z.string().max(160).optional(),
          paymentProofData: z.string().max(8_000_000).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const customer = await customerFromRequest(ctx.req);

        if (!customer) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "سجّل دخولك أولًا للشحن من الرصيد",
          });
        }

        const product = await getSupplierProductById(
          input.supplierProductId
        );

        if (
          !product ||
          !product.approved ||
          !product.enabled ||
          !product.available
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "هذا المنتج غير متاح للشحن حاليًا",
          });
        }

        const externalProductId = Number(product.externalId);

        if (
          !Number.isSafeInteger(externalProductId) ||
          externalProductId <= 0
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "رقم المنتج لدى المورد غير صالح",
          });
        }

        const baseQuantity = Number(product.quantity ?? 1);
        const quantity = input.quantity ?? baseQuantity;

        if (
          !Number.isSafeInteger(baseQuantity) ||
          baseQuantity <= 0 ||
          !Number.isSafeInteger(quantity) ||
          quantity <= 0
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "كمية المنتج غير صالحة",
          });
        }

        const totalCents = Math.round(
          (product.sellingPriceCents * quantity) / baseQuantity
        );

        if (
          !Number.isSafeInteger(totalCents) ||
          totalCents <= 0 ||
          totalCents > 10_000_000
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "تعذر حساب سعر الطلب",
          });
        }

        const spent = await spendCustomerBalance(
          customer.id,
          totalCents
        );

        if (!spent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "رصيدك غير كافٍ لهذه العملية",
          });
        }

        let order;

        try {
          order = await createOrder({
            customerId: customer.id,
            orderNumber: `TS-D-${Date.now()}-${randomBytes(3).toString("hex")}`,
            items: JSON.stringify([
              {
                id: -product.id,
                supplierProductId: externalProductId,
                name: product.name,
                category: product.category || "شحن رقمي",
                targetId: input.targetId?.trim() || undefined,
                quantity,
                price: totalCents,
                digital: true,
              },
            ]),
            total: totalCents,
            customerName: customer.displayName,
            phone: customer.phone || "غير مضاف",
            paymentMethod: "other",
            paymentReference: null,
            paymentProofUrl: null,
            paymentStatus: "confirmed",
            executionStatus: "pending",
            supplierOrderUuid: randomUUID(),
            supplierStatus: "sending",
            supplierAttempts: 0,
          });
        } catch (error) {
          await addCustomerBalance(customer.id, totalCents);
          throw error;
        }

        try {
          await dispatchFast4TopOrder(order);
        } catch (error) {
          console.error(
            "[Fast4Top] Dispatch failed:",
            error instanceof Error ? error.message : error
          );

          try {
            await updateSupplierOrder(order.id, {
              supplierStatus: "review",
              executionStatus: "manual_processing",
              supplierLastError:
                error instanceof Error
                  ? error.message
                  : "تعذر تحديد نتيجة إرسال الطلب",
              ownerNote:
                "الطلب يحتاج مراجعة المالك لدى Fast4Top قبل أي إجراء",
            });
          } catch (updateError) {
            console.error(
              "[Fast4Top] Failed to mark order for review:",
              updateError
            );
          }
        }

        return order;
      }),
  }),

  supplier: router({
    profile: adminProcedure.query(async () => {
      try {
        const profile = await getFast4TopProfile();

        return {
          connected: true,
          balance: profile.balance,
          email: profile.email,
        };
      } catch (error) {
        return {
          connected: false,
          balance: null,
          email: null,
          error:
            error instanceof Error
              ? error.message
              : "تعذر قراءة رصيد Fast4Top",
        };
      }
    }),
sync: adminProcedure.mutation(async () => {
      return await syncFast4TopCatalog();
    }),
    adminCatalog: adminProcedure.query(async () => {
      return {
        connected: true,
        products: await listAllSupplierProducts(),
      };
    }),
    categoryOverrides: adminProcedure.query(async () => listSupplierCategoryOverrides()),
    saveCategory: adminProcedure
      .input(z.object({
        sourceName: z.string().min(1).max(255),
        displayName: z.string().min(1).max(255),
        imageUrl: z.string().max(2_000_000).nullable().optional(),
      }))
      .mutation(async ({ input }) => saveSupplierCategoryOverride(input)),
    publicCategories: publicProcedure.query(async () => listSupplierCategoryOverrides()),
    setApproval: adminProcedure
      .input(z.object({ id: z.number().int().positive(), approved: z.boolean() }))
      .mutation(async ({ input }) => {
        return await setSupplierProductApproval(input.id, input.approved);
      }),
    setEnabled: adminProcedure
      .input(z.object({ id: z.number().int().positive(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return await setSupplierProductEnabled(input.id, input.enabled);
      }),
    setCategoryEnabled: adminProcedure
      .input(z.object({ category: z.string().min(1).max(255), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return await setSupplierCategoryEnabled(input.category, input.enabled);
      }),
    catalog: publicProcedure.query(async () => {
      try {
        return {
          connected: true,
          products: await listApprovedSupplierProducts(),
        };
      } catch (error) {
        console.warn(
          "[Supplier] Approved catalog read failed:",
          error instanceof Error ? error.message : "unknown error"
        );

        return {
          connected: false,
          products: [],
        };
      }
    }),
  }),

  admin: router({
    claim: protectedProcedure.mutation(async ({ ctx }) => {
      if (ENV.ownerEmail || ENV.ownerOpenId) {
        return { claimed: false };
      }

      const claimed = await claimFirstAdmin(ctx.user.openId);

      return { claimed };
    }),

    transferOwnership: adminProcedure
      .input(
        z.object({
          newOwnerEmail: z.string().email(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ENV.ownerEmail || ENV.ownerOpenId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "نقل الملكية يتم من إعدادات المالك الأساسية",
          });
        }

        const result = await transferOwnership(
          ctx.user.openId,
          input.newOwnerEmail
        );

        if (
          !result.transferred &&
          result.reason === "target_not_found"
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "يجب أن يسجل الحساب الجديد دخوله إلى المتجر أولًا",
          });
        }

        if (!result.transferred) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن نقل الملكية إلى الحساب نفسه",
          });
        }

        return result;
      }),

    addAdmin: adminProcedure
      .input(
        z.object({
          email: z.string().email(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await grantAdminByEmail(input.email);

        if (!result.granted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "يجب أن يسجل المدير الثاني دخوله إلى المتجر مرة واحدة أولًا",
          });
        }

        return result;
      }),

    access: adminProcedure.query(({ ctx }) => ({
      userId: ctx.user.id,
      name: ctx.user.name,
      role: ctx.user.role,
      isOwner: Boolean(
        ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId
      ),
    })),

    products: router({
      list: adminProcedure.query(() => listAllProducts()),

            create: adminProcedure
        .input(
          z.object({
            name: z.string().min(2).max(180),
            category: z.string().min(2).max(80),
            description: z.string().max(2000).optional(),
            priceUsdCents: z.number().int().nonnegative(),
            oldPrice: z.number().int().nonnegative().optional(),
            stock: z.number().int().nonnegative(),
            isDigital: z.boolean(),
            tag: z.string().max(60).optional(),
            imageData: z.string().max(12_000_000).optional(),
          })
        )
        .mutation(async ({ input }) => {
          const {
            imageData,
            priceUsdCents,
            ...productInput
          } = input;

          let imageUrl: string | null = null;

          if (imageData) {
            const match = imageData.match(
              /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/
            );

            if (!match) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP.",
              });
            }

            const uploaded = await storagePut(
              `products/product-${Date.now()}-${randomUUID()}`,
              Buffer.from(match[2], "base64"),
              match[1]
            );

            imageUrl = uploaded.url;
          }

          return createProduct({
            ...productInput,
            price: priceUsdCents,
            imageUrl,
          });
        }),

      update: adminProcedure
        .input(
          z.object({
            id: z.number().int().positive(),
            name: z.string().min(2).max(180).optional(),
            category: z.string().min(2).max(80).optional(),
            description: z.string().max(2000).optional(),
            priceUsdCents: z.number().int().nonnegative().optional(),
            oldPrice: z.number().int().nonnegative().optional(),
            stock: z.number().int().nonnegative().optional(),
            isDigital: z.boolean().optional(),
            tag: z.string().max(60).optional(),
            imageUrl: z.string().url().nullable().optional(),
          })
        )
        .mutation(async ({ input }) => {
          const { id, priceUsdCents, ...changes } = input;

          await updateProduct(id, {
            ...changes,
            ...(priceUsdCents !== undefined
              ? { price: priceUsdCents }
              : {}),
          });

          return { success: true };
        }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          await deleteProduct(input.id);
          return { success: true };
        }),
    }),

    orders: router({
      list: adminProcedure.query(() => listOrders()),

      updateStatus: adminProcedure
  .input(
    z.object({
      id: z.number().int().positive(),
      paymentStatus: z
        .enum(["pending", "confirmed", "rejected"])
        .optional(),
      executionStatus: z
        .enum([
          "pending",
          "manual_processing",
          "completed",
          "failed",
        ])
        .optional(),
      ownerNote: z.string().nullable().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { id, ...changes } = input;

    await updateOrderStatus(id, changes);
    return { success: true };
  }),
}),

customers: router({
  addBalance: adminProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        amountCents: z.number().int().positive(),
      })
    )
    .mutation(async ({ input }) => {
      await addCustomerBalance(input.customerId, input.amountCents);
      return { success: true };
    }),
}),
}),
});

export type AppRouter = typeof appRouter;
