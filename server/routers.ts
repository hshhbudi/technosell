import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addCustomerBalance, claimFirstAdmin, createOrder, createProduct, deleteProduct, listAllProducts, listOrders, listProducts, spendCustomerBalance, transferOwnership, updateOrderStatus, updateProduct } from "./db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { createCustomer, getCustomerByEmail, getCustomerById } from "./db";
import { storagePut } from "./storage";
import { readDigitalCatalog } from "./fast4top";

const CUSTOMER_COOKIE = "technosell_customer";
const customerSecret = () => new TextEncoder().encode(ENV.cookieSecret || "technosell-development-secret");
const hashPassword = (password: string, salt = randomBytes(16).toString("hex")) => `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const passwordMatches = (password: string, stored: string) => { const [salt, digest] = stored.split(":"); if (!salt || !digest) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(digest, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); };
const customerSafe = (customer: Awaited<ReturnType<typeof getCustomerById>>) => customer && ({ id: customer.id, displayName: customer.displayName, email: customer.email, phone: customer.phone, freeFireId: customer.freeFireId, pubgId: customer.pubgId, pubgServerId: customer.pubgServerId, takaId: customer.takaId, bigoId: customer.bigoId, balanceCents: customer.balanceCents });
async function customerFromRequest(req: { headers: { cookie?: string } }) {
  const token = parseCookie(req.headers.cookie ?? "")[CUSTOMER_COOKIE]; if (!token) return undefined;
  try { const { payload } = await jwtVerify(token, customerSecret()); return typeof payload.sub === "string" ? getCustomerById(Number(payload.sub)) : undefined; } catch { return undefined; }
}
async function setCustomerCookie(res: any, id: number) { const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(id)).setIssuedAt().setExpirationTime("30d").sign(customerSecret()); res.cookie(CUSTOMER_COOKIE, token, { httpOnly: true, secure: true, sameSite: "none", path: "/" }); }

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  customer: router({
    me: publicProcedure.query(async ({ ctx }) => customerSafe(await customerFromRequest(ctx.req))),
    register: publicProcedure.input(z.object({
      displayName: z.string().min(2).max(120), email: z.string().email().max(320), password: z.string().min(8).max(200), phone: z.string().max(40).optional(),
      freeFireId: z.string().max(120).optional(), pubgId: z.string().max(120).optional(), pubgServerId: z.string().max(120).optional(), takaId: z.string().max(120).optional(), bigoId: z.string().max(120).optional(),
    })).mutation(async ({ input, ctx }) => {
      if (await getCustomerByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "هذا البريد مسجل مسبقًا" });
      const { password, ...profile } = input;
      const customer = await createCustomer({ ...profile, email: input.email.toLowerCase(), passwordHash: hashPassword(password), phone: input.phone || null, freeFireId: input.freeFireId || null, pubgId: input.pubgId || null, pubgServerId: input.pubgServerId || null, takaId: input.takaId || null, bigoId: input.bigoId || null });
      await setCustomerCookie(ctx.res, customer.id); return customerSafe(customer);
    }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      const customer = await getCustomerByEmail(input.email);
      if (!customer || !passwordMatches(input.password, customer.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد أو كلمة المرور غير صحيحة" });
      await setCustomerCookie(ctx.res, customer.id); return customerSafe(customer);
    }),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(CUSTOMER_COOKIE, { httpOnly: true, secure: true, sameSite: "none", path: "/" }); return { success: true }; }),
    requestWalletTopup: publicProcedure.input(z.object({ amountCents: z.number().int().positive().max(10_000_000), paymentReference: z.string().max(160).optional() })).mutation(async ({ input, ctx }) => {
      const customer = await customerFromRequest(ctx.req);
      if (!customer) throw new TRPCError({ code: "UNAUTHORIZED", message: "سجّل دخولك أولًا لطلب تعبئة الرصيد" });
      return createOrder({ customerId: customer.id, orderNumber: `TS-W-${Date.now().toString().slice(-8)}`, items: JSON.stringify([{ id: 0, name: "تعبئة رصيد الحساب", category: "تعبئة الرصيد", price: input.amountCents, digital: true }]), total: input.amountCents, customerName: customer.displayName, phone: customer.phone || "غير مضاف", paymentMethod: "shamcash", paymentReference: input.paymentReference || null });
    }),
    directTopup: publicProcedure.input(z.object({ supplierProductId: z.number().int().positive(), name: z.string().max(180), category: z.string().max(80), targetId: z.string().min(1).max(160), quantity: z.number().positive().max(100_000_000).optional(), totalCents: z.number().int().positive().max(10_000_000) })).mutation(async ({ input, ctx }) => {
      const customer = await customerFromRequest(ctx.req);
      if (!customer) throw new TRPCError({ code: "UNAUTHORIZED", message: "سجّل دخولك أولًا للشحن من الرصيد" });
      const spent = await spendCustomerBalance(customer.id, input.totalCents);
      if (!spent) throw new TRPCError({ code: "BAD_REQUEST", message: "رصيدك غير كافٍ لهذه العملية" });
      try {
        return await createOrder({ customerId: customer.id, orderNumber: `TS-D-${Date.now().toString().slice(-8)}`, items: JSON.stringify([{ id: -input.supplierProductId, supplierProductId: input.supplierProductId, name: input.name, category: input.category, targetId: input.targetId, quantity: input.quantity, price: input.totalCents, digital: true }]), total: input.totalCents, customerName: customer.displayName, phone: customer.phone || "غير مضاف", paymentMethod: "other", paymentStatus: "confirmed", executionStatus: "pending" });
      } catch (error) {
        await addCustomerBalance(customer.id, input.totalCents);
        throw error;
      }
    }),
  }),

  supplier: router({
    // Read-only catalog sync. Order creation is intentionally not exposed here yet.
    catalog: publicProcedure.query(async () => {
      try {
        return { connected: true, products: await readDigitalCatalog() };
      } catch (error) {
        console.warn("[Fast4Top] Catalog read failed:", error instanceof Error ? error.message : "unknown error");
        return { connected: false, products: [] };
      }
    }),
  }),

  admin: router({
    claim: protectedProcedure.mutation(async ({ ctx }) => {
      if (ENV.ownerEmail || ENV.ownerOpenId) return { claimed: false };
      const claimed = await claimFirstAdmin(ctx.user.openId);
      return { claimed };
    }),
    transferOwnership: adminProcedure.input(z.object({ newOwnerEmail: z.string().email() })).mutation(async ({ ctx, input }) => {
      if (ENV.ownerEmail || ENV.ownerOpenId) throw new TRPCError({ code: "FORBIDDEN", message: "نقل الملكية يتم من إعدادات المالك الأساسية" });
      const result = await transferOwnership(ctx.user.openId, input.newOwnerEmail);
      if (!result.transferred && result.reason === "target_not_found") throw new TRPCError({ code: "NOT_FOUND", message: "يجب أن يسجل الحساب الجديد دخوله إلى المتجر أولًا" });
      if (!result.transferred) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن نقل الملكية إلى الحساب نفسه" });
      return result;
    }),
    access: adminProcedure.query(({ ctx }) => ({
      userId: ctx.user.id,
      name: ctx.user.name,
      role: ctx.user.role,
      isOwner: Boolean(ENV.ownerOpenId && ctx.user.openId === ENV.ownerOpenId),
    })),
    products: router({
      list: adminProcedure.query(() => listAllProducts()),
      create: adminProcedure.input(z.object({
        name: z.string().min(2).max(180),
        category: z.string().min(2).max(80),
        description: z.string().max(2000).optional(),
        priceUsdCents: z.number().int().nonnegative(),
        oldPrice: z.number().int().nonnegative().optional(),
        stock: z.number().int().nonnegative(),
        isDigital: z.boolean(),
        tag: z.string().max(60).optional(),
        imageData: z.string().max(12_000_000).optional(),
      })).mutation(async ({ input }) => {
        const { imageData, ...productInput } = input;
        let imageUrl: string | null = null;
        if (imageData) {
          const match = imageData.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
          if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP" });
          const uploaded = await storagePut(`products/product-${Date.now()}-${randomUUID()}.jpg`, Buffer.from(match[2], "base64"), match[1]);
          imageUrl = uploaded.url;
        }
        const isDigitalTopup = productInput.isDigital && ["شحن ألعاب", "شحن تطبيقات"].includes(productInput.category);
        return createProduct({
          ...productInput,
          price: productInput.priceUsdCents,
          priceUsdCents: productInput.priceUsdCents,
          description: productInput.description || null,
          oldPrice: productInput.oldPrice || null,
          tag: productInput.tag || null,
          imageUrl,
          fulfillmentUrl: isDigitalTopup ? "https://www.syria-market.net/categories/3/subs/3/product/5" : null,
        });
      }),
      update: adminProcedure.input(z.object({
        id: z.number().int().positive(), name: z.string().min(2).max(180), category: z.string().min(2).max(80),
        description: z.string().max(2000).optional(), priceUsdCents: z.number().int().nonnegative(),
        oldPrice: z.number().int().nonnegative().optional(), stock: z.number().int().nonnegative(),
        isDigital: z.boolean(), tag: z.string().max(60).optional(), imageData: z.string().max(12_000_000).optional(),
      })).mutation(async ({ input }) => {
        const { id, imageData, ...productInput } = input;
        let imageUrl: string | undefined;
        if (imageData) {
          const match = imageData.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
          if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WEBP" });
          const uploaded = await storagePut(`products/product-${Date.now()}-${randomUUID()}.jpg`, Buffer.from(match[2], "base64"), match[1]);
          imageUrl = uploaded.url;
        }
        return updateProduct(id, { ...productInput, price: productInput.priceUsdCents, priceUsdCents: productInput.priceUsdCents, description: productInput.description || null, oldPrice: productInput.oldPrice || null, tag: productInput.tag || null, ...(imageUrl ? { imageUrl } : {}) });
      }),
      remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteProduct(input.id)),
    }),
  }),

  products: router({
    list: publicProcedure.query(() => listProducts()),
  }),

  orders: router({
    create: publicProcedure.input(z.object({
      items: z.array(z.object({ id: z.number(), name: z.string(), category: z.string().optional(), price: z.number(), digital: z.boolean().optional() })).min(1),
      total: z.number().int().nonnegative(),
      customerName: z.string().min(2).max(160),
      phone: z.string().min(5).max(40),
      playerId: z.string().max(120).optional(),
      serverId: z.string().max(120).optional(),
      paymentMethod: z.enum(["shamcash", "other"]).default("shamcash"),
      paymentReference: z.string().max(160).optional(),
    })).mutation(({ input }) => createOrder({
      orderNumber: `TS-${Date.now().toString().slice(-8)}`,
      items: JSON.stringify(input.items),
      total: input.total,
      customerName: input.customerName,
      phone: input.phone,
      playerId: input.playerId || null,
      serverId: input.serverId || null,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference || null,
    })),
  }),

  adminOrders: router({
    list: adminProcedure.query(() => listOrders()),
    updateStatus: adminProcedure.input(z.object({
      id: z.number().int().positive(),
      paymentStatus: z.enum(["pending", "confirmed", "rejected"]).optional(),
      executionStatus: z.enum(["pending", "manual_processing", "completed", "failed"]).optional(),
      ownerNote: z.string().max(2000).nullable().optional(),
    })).mutation(({ input }) => updateOrderStatus(input.id, input)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
