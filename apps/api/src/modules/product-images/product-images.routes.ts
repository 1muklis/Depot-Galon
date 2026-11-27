import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { upload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { productImagesService as s } from './product-images.service.js';
import { addImageUrlBody, imageParam, productParam, updateImageBody } from './product-images.schema.js';

/** Dipasang di /products/:productId/images */
export const productImagesRouter = Router({ mergeParams: true });

productImagesRouter.get('/', validate({ params: productParam }), asyncHandler(async (req, res) => ok(res, await s.list(req.params.productId!))));

productImagesRouter.use(authenticate, authorize(Role.ADMIN));
productImagesRouter.post('/', upload.single('image'), asyncHandler(async (req, res) => {
  const params = productParam.parse(req.params);
  const body = req.file ? { isPrimary: req.body.isPrimary === 'true' } : addImageUrlBody.parse(req.body);
  const img = await s.add(params.productId, { ...body, file: req.file });
  await writeAudit({ req, action: 'ADD_IMAGE', entity: 'Product', entityId: params.productId, newValue: img });
  created(res, img);
}));
productImagesRouter.patch('/:imageId', validate({ params: imageParam, body: updateImageBody }), asyncHandler(async (req, res) => ok(res, await s.update(req.params.productId!, req.params.imageId!, req.body))));
productImagesRouter.delete('/:imageId', validate({ params: imageParam }), asyncHandler(async (req, res) => {
  await s.remove(req.params.productId!, req.params.imageId!);
  await writeAudit({ req, action: 'REMOVE_IMAGE', entity: 'Product', entityId: req.params.productId, oldValue: { imageId: req.params.imageId } });
  noContent(res);
}));
