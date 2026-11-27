import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { reportsService as s } from './reports.service.js';
import { rangeQuery, salesQuery, topQuery, type RangeQuery, type SalesQuery, type TopQuery } from './reports.schema.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize(Role.ADMIN));

reportsRouter.get('/dashboard', asyncHandler(async (_req, res) => ok(res, await s.dashboard())));
reportsRouter.get('/sales', validate({ query: salesQuery }), asyncHandler(async (req, res) => ok(res, await s.sales(req.query as unknown as SalesQuery))));
reportsRouter.get('/top-products', validate({ query: topQuery }), asyncHandler(async (req, res) => ok(res, await s.topProducts(req.query as unknown as TopQuery))));
reportsRouter.get('/top-customers', validate({ query: topQuery }), asyncHandler(async (req, res) => ok(res, await s.topCustomers(req.query as unknown as TopQuery))));
reportsRouter.get('/payments', validate({ query: rangeQuery }), asyncHandler(async (req, res) => ok(res, await s.payments(req.query as unknown as RangeQuery))));
reportsRouter.get('/couriers', validate({ query: rangeQuery }), asyncHandler(async (req, res) => ok(res, await s.couriers(req.query as unknown as RangeQuery))));
reportsRouter.get('/stock', asyncHandler(async (_req, res) => ok(res, await s.stock())));
reportsRouter.get('/gallons', asyncHandler(async (_req, res) => ok(res, await s.gallons())));
