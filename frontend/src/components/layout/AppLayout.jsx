import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CreateProjectModal from '../project/CreateProjectModal'

export default function AppLayout() {
  const [showCreateProject, setShowCreateProject] = useState(false)

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      <Sidebar onCreateProject={() => setShowCreateProject(true)} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {showCreateProject && (
        <CreateProjectModal onClose={() => setShowCreateProject(false)} />
      )}
    </div>
  )
}
