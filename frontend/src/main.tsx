import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createBrowserRouter } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';

import { ArticlePage } from '@/pages/article';
import { EditorPage } from '@/pages/editor';
import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';

import '@/app/styles/global.css';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/new', element: <EditorPage /> },
  { path: '/edit/:slug', element: <EditorPage /> },
  { path: '/:slug', element: <ArticlePage /> },
  { path: '*', element: <NotFoundPage /> },
]);

const root = document.getElementById('root');

if (!root) throw new Error('Root element was not found');

ReactDOM.createRoot(root).render(
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
