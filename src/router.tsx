import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { PlanPage } from './pages/PlanPage'
import { LabPage } from './pages/LabPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectPage } from './pages/ProjectPage'
import { NotFound } from './pages/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'lab/:labId', element: <LabPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'project/:projectId', element: <ProjectPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
