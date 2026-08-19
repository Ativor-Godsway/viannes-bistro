import { Router } from 'express';
import { listMenu, getMenuItem, listCategories } from '../controllers/menu';

const router = Router();

router.get('/menu', listMenu);
router.get('/menu/:id', getMenuItem);
router.get('/categories', listCategories);

export default router;
