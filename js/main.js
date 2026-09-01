import AppModel from './models/AppModel.js';
import AppView from './views/AppView.js';
import AppController from './controllers/AppController.js';

document.addEventListener('DOMContentLoaded', () => {
  const model = new AppModel();
  const view = new AppView();
  const app = new AppController(model, view);
});
