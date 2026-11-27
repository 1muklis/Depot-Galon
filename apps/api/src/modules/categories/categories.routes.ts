import { createCrudRouter } from '../../core/utils/crud.js';
import { slugify } from '../../core/utils/helpers.js';
import { createCategoryBody, updateCategoryBody } from './categories.schema.js';

export const categoriesRouter = createCrudRouter({
  model: 'category',
  entity: 'Category',
  createSchema: createCategoryBody,
  updateSchema: updateCategoryBody,
  searchFields: ['name', 'description'],
  filterFields: ['isActive'],
  defaultOrderBy: { name: 'asc' },
  publicRead: true,
  publicWhere: { isActive: true },
  uploadFolder: 'categories',
  beforeWrite: (data, existing) => ({ ...data, ...((data.slug || data.name) && { slug: data.slug ?? (existing ? undefined : slugify(data.name)) }) }),
});
