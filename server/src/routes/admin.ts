import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { adminWriteLimiter } from '../middleware/rateLimit';
import { upload } from '../middleware/upload';
import * as adminOrder from '../controllers/adminOrder';
import * as adminMenu from '../controllers/adminMenu';

const router = Router();

// Authentication AND authorisation, on every route in this file — the role is
// read from the verified JWT, never from the request.
router.use(requireAuth, requireAdmin, adminWriteLimiter);

router.get('/dashboard', adminMenu.dashboard);

// Orders
router.get('/orders', adminOrder.listOrders);
router.get('/orders/:id', adminOrder.getOrder);
router.patch('/orders/:id/status', adminOrder.updateStatus);
router.delete('/orders/:id', adminOrder.deleteOrder);

// Menu — /menu/reorder is declared before /menu/:id so "reorder" is never
// swallowed as an item id.
router.get('/menu', adminMenu.listMenu);
router.post('/menu', adminMenu.createMenuItem);
router.patch('/menu/reorder', adminMenu.reorderMenu);
router.get('/menu/:id', adminMenu.getMenuItem);
router.patch('/menu/:id', adminMenu.updateMenuItem);
router.delete('/menu/:id', adminMenu.deleteMenuItem);
router.patch('/menu/:id/availability', adminMenu.setItemAvailability);
router.patch(
  '/menu/:id/groups/:groupId/options/:optionId/availability',
  adminMenu.setOptionAvailability
);
router.post('/menu/:id/attach-template', adminMenu.attachTemplate);
router.post('/menu/:id/upload-image', upload.single('image'), adminMenu.uploadItemImage);

// Reusable modifier group templates
router.get('/modifier-templates', adminMenu.listTemplates);
router.post('/modifier-templates', adminMenu.createTemplate);
router.patch('/modifier-templates/:id', adminMenu.updateTemplate);
router.delete('/modifier-templates/:id', adminMenu.deleteTemplate);
router.post('/modifier-templates/:id/sync', adminMenu.syncTemplate);

// Categories
router.post('/categories', adminMenu.createCategory);
router.patch('/categories/reorder', adminMenu.reorderCategories);
router.patch('/categories/:id', adminMenu.updateCategory);
router.delete('/categories/:id', adminMenu.deleteCategory);

export default router;
