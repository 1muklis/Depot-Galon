import { createCrudRouter } from '../../core/utils/crud.js';
import { slugify } from '../../core/utils/helpers.js';
import { createBrandBody, updateBrandBody } from './brands.schema.js';

export const brandsRouter = createCrudRouter({
  model: 'brand',
  entity: 'Brand',
  createSchema: createBrandBody,
  updateSchema: updateBrandBody,
  searchFields: ['name'],
  filterFields: ['isActive'],
  defaultOrderBy: { name: 'asc' },
  publicRead: true,
  publicWhere: { isActive: true },
  uploadFolder: 'brands',
  beforeWrite: (data, existing) => ({ ...data, ...((data.slug || data.name) && { slug: data.slug ?? (existing ? undefined : slugify(data.name)) }) }),
});
