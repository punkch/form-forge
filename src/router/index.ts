import { createRouter, createWebHashHistory } from 'vue-router'

import { embedDetection } from '@/embed/detect'

// Embed mode replaces the library at '/' with the host-driven waiting screen,
// making the user's local form library unreachable from an embedding host.
const embedded = embedDetection().active

// Hash history: the app must work from any static host (or file://) without
// server rewrite rules.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'library',
      component: embedded
        ? () => import('@/views/EmbedWaitingView.vue')
        : () => import('@/views/FormLibraryView.vue'),
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
