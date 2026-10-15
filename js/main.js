import AppModel from './models/AppModel.js';
import AppView from './views/AppView.js';
import AppController from './controllers/AppController.js';
import { SCHOOL_YEAR_LABEL } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-school-year-label]').forEach(el => { el.textContent = SCHOOL_YEAR_LABEL; });
  const model = new AppModel();
  const view = new AppView();
  const app = new AppController(model, view);
});
