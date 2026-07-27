import { createRouter, createWebHistory } from 'vue-router';
import CustomerLayout from '../layouts/CustomerLayout.vue';
import PlatformLayout from '../layouts/PlatformLayout.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/app/overzicht' },
    {
      path: '/app',
      component: CustomerLayout,
      children: [
        { path: '', redirect: '/app/overzicht' },
        { path: 'overzicht', name: 'app-overzicht', component: () => import('../pages/customer/OverzichtPage.vue') },
        { path: 'matches', name: 'app-matches', component: () => import('../pages/customer/MatchesPage.vue') },
        {
          path: 'matches/:id',
          name: 'app-match-detail',
          component: () => import('../pages/customer/MatchDossierPage.vue'),
        },
        {
          path: 'bewaakte-merken',
          name: 'app-bewaakte-merken',
          component: () => import('../pages/customer/BewaakteMerkenPage.vue'),
        },
        {
          path: 'bewaakte-merken/nieuw',
          name: 'app-bewaakte-merken-nieuw',
          component: () => import('../pages/customer/AddWatchWizard.vue'),
        },
        {
          path: 'bewaakte-merken/:id',
          name: 'app-watched-trademark-detail',
          component: () => import('../pages/customer/WatchedTrademarkDetailPage.vue'),
        },
        { path: 'deadlines', name: 'app-deadlines', component: () => import('../pages/customer/DeadlinesPage.vue') },
        { path: 'archief', name: 'app-archief', component: () => import('../pages/customer/ArchiefPage.vue') },
        {
          path: 'organisatie',
          name: 'app-organisatie',
          component: () => import('../pages/customer/OrganisatiePage.vue'),
        },
        { path: 'abonnement', name: 'app-abonnement', component: () => import('../pages/customer/AbonnementPage.vue') },
        {
          path: 'instellingen',
          name: 'app-instellingen',
          component: () => import('../pages/customer/InstellingenPage.vue'),
        },
        {
          path: 'databronnen',
          name: 'app-databronnen',
          component: () => import('../pages/customer/DatabronnenPage.vue'),
        },
      ],
    },
    {
      path: '/platform',
      component: PlatformLayout,
      children: [
        { path: '', redirect: '/platform/overzicht' },
        {
          path: 'overzicht',
          name: 'platform-overzicht',
          component: () => import('../pages/platform/OverzichtPage.vue'),
        },
        { path: 'klanten', name: 'platform-klanten', component: () => import('../pages/platform/KlantenPage.vue') },
        { path: 'accounts', name: 'platform-accounts', component: () => import('../pages/platform/AccountsPage.vue') },
        {
          path: 'abonnementen',
          name: 'platform-abonnementen',
          component: () => import('../pages/platform/AbonnementenPage.vue'),
        },
        {
          path: 'registers',
          name: 'platform-registers',
          component: () => import('../pages/platform/RegistersPage.vue'),
        },
        { path: 'imports', name: 'platform-imports', component: () => import('../pages/platform/ImportsPage.vue') },
        {
          path: 'matches-scoring',
          name: 'platform-matches-scoring',
          component: () => import('../pages/platform/MatchesScoringPage.vue'),
        },
        { path: 'ai-kosten', name: 'platform-ai-kosten', component: () => import('../pages/platform/AiKostenPage.vue') },
        {
          path: 'jobs-fouten',
          name: 'platform-jobs-fouten',
          component: () => import('../pages/platform/JobsFoutenPage.vue'),
        },
        {
          path: 'notificaties',
          name: 'platform-notificaties',
          component: () => import('../pages/platform/NotificatiesPage.vue'),
        },
        { path: 'exports', name: 'platform-exports', component: () => import('../pages/platform/ExportsPage.vue') },
        {
          path: 'systeeminstellingen',
          name: 'platform-systeeminstellingen',
          component: () => import('../pages/platform/SysteeminstellingenPage.vue'),
        },
        { path: 'auditlog', name: 'platform-auditlog', component: () => import('../pages/platform/AuditlogPage.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
});
