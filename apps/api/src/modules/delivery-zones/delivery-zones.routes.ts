import { createCrudRouter } from '../../core/utils/crud.js';
import { createZoneBody, updateZoneBody } from './delivery-zones.schema.js';

export const deliveryZonesRouter = createCrudRouter({
  model: 'deliveryZone',
  entity: 'DeliveryZone',
  createSchema: createZoneBody,
  updateSchema: updateZoneBody,
  searchFields: ['name', 'description'],
  filterFields: ['isActive'],
  defaultOrderBy: { name: 'asc' },
  publicRead: true,
  publicWhere: { isActive: true },
});
