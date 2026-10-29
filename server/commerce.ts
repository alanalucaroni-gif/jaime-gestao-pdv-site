import { registerDeliveryMaps, verifiedDelivery } from './delivery-maps';
import { deliverySettings } from './delivery-settings';
import { saveProduct, createSale } from "./catalog";
import crypto from 'node:crypto';
import type { Request, Response, NextFunction, Express } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { z } from 'zod';
import { customerOrder, deliveryCents, directMenu, directOrders, findOrder, newOrder, saveOrder, type DirectOrder } from './commerce-store';

const digest = (s: string) => crypto.createHash('sha256').update(s).digest();
export function isLocalDevelopment(req: Request) { return process.env.NODE_ENV === 'development' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') && ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname); }
export function adminAccess(req: Request, res: Response, next: NextFunction) {
  if (isLocalDevelopment(req)) return next();
  const expected = process.env.ADMIN_PASSWORD;
  const auth = req.header('authorization') || '';
  const actual = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString() : '';
  if (expected && expected.length >= 16 && crypto.timingSafeEqual(digest(actual), digest(`${process.env.ADMIN_USER || 'admin'}:${expected}`))) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Gestao Jaime", charset="UTF-8"');
  res.status(401).send('Entre com o usuário e a senha da gestão.');
}
export function onlineEnabled() { return Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_PUBLIC_KEY && process.env.MP_WEBHOOK_SECRET && process.env.PUBLIC_URL?.startsWith('https://')); }
const provider = () => new Payment(new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '', options: { timeout: 10000 } }));
export function validWebhook(id: string, signature: string, requestId: string, secret: string, now = Date.now()) {
  const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
  if (!secret || !requestId || !id || !/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  const timestamp = Number(parts.ts); const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (Math.abs(now - milliseconds) > 5 * 60_000) return false;
  const expected = crypto.createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
}
type ProviderPayment = Awaited<ReturnType<Payment['get']>>;
export function applyPayment(order: DirectOrder, payment: ProviderPayment) {
  const latest = findOrder(order.publicId); if (latest) Object.assign(order, latest);
  if (payment.external_reference !== order.publicId || payment.currency_id !== 'BRL' || Math.round(Number(payment.transaction_amount) * 100) !== Math.round(Number(order.total) * 100)) throw new Error('Pagamento não corresponde ao pedido');
  if (payment.live_mode !== (process.env.MP_MODE === 'production')) throw new Error('Ambiente de pagamento incorreto');
  if (order.paymentMethod !== 'online' || (order.paymentId && order.paymentId !== String(payment.id))) throw new Error('Pagamento não corresponde ao pedido');
  const date = payment.date_last_updated || payment.date_created || '';
  if (order.paymentUpdated && date && date < order.paymentUpdated) return;
  const mapped: Record<string, DirectOrder['paymentStatus']> = { approved: 'paid', rejected: 'failed', cancelled: 'failed', refunded: 'refunded', charged_back: 'charged_back', pending: 'pending', in_process: 'pending', authorized: 'pending' };
  const status = mapped[payment.status || ''];
  if (!status) throw new Error('Status de pagamento desconhecido');
  if (['paid','refunded','charged_back'].includes(order.paymentStatus) && ['pending','failed'].includes(status)) return;
  order.paymentId = String(payment.id); order.paymentStatus = status; order.paymentUpdated = date;
  const qr = payment.point_of_interaction?.transaction_data;
  order.qrCode = qr?.qr_code; order.qrImage = qr?.qr_code_base64;
  saveOrder(order);
}
const paymentForm = z.object({ payment_method_id: z.string().min(1).max(50), token: z.string().max(200).optional(), installments: z.number().int().min(1).max(1).optional(), issuer_id: z.union([z.string(), z.number()]).optional(), payer: z.object({ email: z.string().email(), identification: z.object({ type: z.string().max(20), number: z.string().max(30) }).optional() }) });
const activePayments = new Set<string>();
export function registerCommerce(app: Express) {
  const limits = new Map<string, { start: number; count: number }>();
  app.use('/api/direct', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.path === '/webhook') return next();
    const key = req.socket.remoteAddress || 'unknown'; const now = Date.now();
    for (const [ip, entry] of limits) if (now - entry.start > 60_000) limits.delete(ip);
    const entry = limits.get(key) || { start: now, count: 0 }; entry.count++; limits.set(key, entry);
    if (entry.count > 120) return res.status(429).json({ error: 'Aguarde um momento e tente novamente.' });
    if (req.method !== 'GET') {
      const origin = req.header('origin');
      const allowed = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).origin : `http://${req.get('host')}`;
      if (origin && origin !== allowed) return res.status(403).json({ error: 'Origem inválida' });
    }
    next();
  });
  registerDeliveryMaps(app, adminAccess);
  app.get('/api/direct/config', (_req, res) => res.json({ routeDelivery: true, deliveryAvailable: deliverySettings().enabled && Boolean(process.env.GOOGLE_MAPS_API_KEY), online: onlineEnabled(), publicKey: onlineEnabled() ? process.env.MP_PUBLIC_KEY : '', deliveryFee: null }));
  app.get('/api/direct/menu', (_req, res) => res.json(directMenu()));
  app.post('/api/direct/orders', (req, res) => {
    try {
      if (req.body.paymentMethod === 'online' && !onlineEnabled()) return res.status(503).json({ error: 'Pagamento online ainda não está disponível. Escolha pagar na entrega ou retirada.' });
      if (req.body.deliveryType === 'delivery' && (!deliverySettings().enabled || !process.env.GOOGLE_MAPS_API_KEY)) return res.status(503).json({ error: 'Entrega temporariamente indisponível. Escolha retirada.' });
      const fee = req.body.deliveryType === 'delivery' ? verifiedDelivery(req.body.deliveryToken, req.body.address) : undefined;
      const order = newOrder(req.body, fee); res.status(201).json({ ...customerOrder(order), token: order.token });
    } catch (error) { res.status(400).json({ error: error instanceof z.ZodError ? 'Confira nome, telefone, endereço e itens.' : error instanceof Error ? error.message : 'Não foi possível criar o pedido.' }); }
  });
  function authorized(req: Request) { const order = findOrder(String(req.params.id)); const token = req.header('x-order-token') || ''; return order && crypto.timingSafeEqual(digest(token), digest(order.token)) ? order : undefined; }
  app.get('/api/direct/orders/:id', async (req, res) => {
    const order = authorized(req); if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    // Reconcile only on explicit refresh, and still obtain status from the provider.
    if (req.query.refresh === '1' && order.paymentFingerprint && onlineEnabled()) {
      try {
        let paymentId = order.paymentId;
        if (!paymentId) { const found = await provider().search({ options: { external_reference: order.publicId } }); paymentId = found.results?.[0]?.id; }
        if (paymentId) applyPayment(order, await provider().get({ id: paymentId }));
      } catch { return res.status(503).json({ error: 'Não foi possível atualizar o pagamento agora.' }); }
    }
    res.json(customerOrder(findOrder(order.publicId)!));
  });
  app.post('/api/direct/orders/:id/payment', async (req, res) => {
    const order = authorized(req); if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!onlineEnabled() || order.paymentMethod !== 'online') return res.status(503).json({ error: 'Pagamento online indisponível' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'Pedido cancelado' });
    if (activePayments.has(order.publicId)) return res.status(409).json({ error: 'Pagamento em processamento. Aguarde.' });
    activePayments.add(order.publicId);
    try {
      if (order.paymentId) { applyPayment(order, await provider().get({ id: order.paymentId })); return res.json(customerOrder(order)); }
      const form = paymentForm.parse(req.body);
      if (form.payment_method_id !== 'pix' && !form.token) return res.status(400).json({ error: 'Dados de cartão inválidos' });
      const fingerprint = digest(JSON.stringify(form)).toString('hex');
      if (order.paymentFingerprint && order.paymentFingerprint !== fingerprint) return res.status(409).json({ error: 'Uma tentativa já foi enviada. Atualize o status antes de tentar novamente.' });
      order.paymentFingerprint = fingerprint; order.paymentKey ||= crypto.randomUUID(); saveOrder(order);
      const payment = await provider().create({ body: { ...form, issuer_id: form.issuer_id === undefined ? undefined : Number(form.issuer_id), transaction_amount: Number(order.total), description: `Pedido J’aime ${order.publicId}`, external_reference: order.publicId, notification_url: `${process.env.PUBLIC_URL!.replace(/\/$/, '')}/api/direct/webhook` }, requestOptions: { idempotencyKey: order.paymentKey } });
      applyPayment(order, payment); res.json(customerOrder(order));
    } catch { res.status(502).json({ error: 'Não foi possível confirmar o pagamento. Atualize o status; não crie outro pedido.' }); }
    finally { activePayments.delete(order.publicId); }
  });
  app.post('/api/direct/webhook', async (req, res) => {
    const id = String(req.query['data.id'] || '');
    if (!validWebhook(id, req.header('x-signature') || '', req.header('x-request-id') || '', process.env.MP_WEBHOOK_SECRET || '')) return res.sendStatus(401);
    if (req.body.type !== 'payment') return res.sendStatus(200);
    try { const payment = await provider().get({ id }); const order = findOrder(payment.external_reference || ''); if (order) applyPayment(order, payment); res.sendStatus(200); }
    catch { res.sendStatus(503); }
  });
  app.put('/api/direct/admin/products', adminAccess, (req,res)=>{try{res.json(saveProduct(req.body));}catch(e){res.status(400).json({error:e instanceof z.ZodError?'Confira os campos do produto.':(e as Error).message});}});
  app.post('/api/direct/admin/sales', adminAccess, (req,res)=>{try{const {token,...sale}=createSale(req.body);res.status(201).json(sale);}catch(e){res.status(400).json({error:e instanceof z.ZodError?'Confira os dados da venda.':(e as Error).message});}});
  app.get('/api/direct/admin/orders', adminAccess, (_req, res) => res.json(directOrders().map(({token, requestId, paymentKey, paymentFingerprint, ...order}) => order)));
}


