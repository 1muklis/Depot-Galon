import { createCrudRouter } from '../../core/utils/crud.js';
import { createSlotBody, updateSlotBody } from './delivery-slots.schema.js';

export const deliverySlotsRouter = createCrudRouter({
  model: 'deliverySlot',
  entity: 'DeliverySlot',
  createSchema: createSlotBody,
  updateSchema: updateSlotBody,
  searchFields: ['label'],
  filterFields: ['isActive'],
  defaultOrderBy: { startTime: 'asc' },
  publicRead: true,
  publicWhere: { isActive: true },
});
