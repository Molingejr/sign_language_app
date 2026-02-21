import { useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { FEATURES, FEATURE_BY_PATH } from '../features'
import type { FeatureId } from '../features'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-semibold leading-6 transition-colors ${
    isActive ? 'text-accent' : 'text-muted hover:text-text'
  }`

const mobileNavLinkClass = (activeFeature: FeatureId, id: FeatureId) =>
  `-mx-3 block w-full rounded-lg px-3 py-2.5 text-left text-base font-semibold transition-colors ${
    activeFeature === id ? 'bg-teal-50 text-accent' : 'text-text hover:bg-border/50'
  }`

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const activeFeature: FeatureId = FEATURE_BY_PATH[location.pathname] ?? 'interpretation'

  return (
    <header className="border-b-2 border-border bg-card shadow-card">
      <nav
        aria-label="Global"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
      >
        <div className="flex lg:flex-1">
          <NavLink to="/" className="-m-1.5 flex items-center gap-2 p-1.5">
            <span className="sr-only">Sign Language</span>
            <span className="text-lg font-bold tracking-tight text-text">
              Sign Language
            </span>
          </NavLink>
        </div>

        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-text"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden className="size-6" />
          </button>
        </div>

        <div className="hidden lg:flex lg:gap-x-8">
          {FEATURES.map(({ id, path, label }) => (
            <NavLink
              key={id}
              to={path}
              className={navLinkClass}
              end={path === '/'}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          <span className="text-sm font-semibold leading-6 text-muted">
            Sign Language App
          </span>
        </div>
      </nav>

      <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
        <div className="fixed inset-0 z-50" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-card px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-border">
          <div className="flex items-center justify-between">
            <NavLink
              to="/"
              className="text-lg font-bold tracking-tight text-text"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign Language
            </NavLink>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-text"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden className="size-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-border">
              <div className="space-y-1 py-6">
                {FEATURES.map(({ id, path, label }) => (
                  <NavLink
                    key={id}
                    to={path}
                    className={mobileNavLinkClass(activeFeature, id)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  )
}
