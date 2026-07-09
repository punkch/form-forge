import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history: the app must work from any static host (or file://) without
// server rewrite rules.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: () => import('@/views/FormLibraryView.vue'),
    },
    {
      path: '/forms/:formId',
      name: 'editor',
      component: () => import('@/views/FormEditorView.vue'),
      props: true,
    },
    {
      path: '/forms/:formId/preview',
      name: 'preview',
      component: () => import('@/views/FullPreviewView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})
