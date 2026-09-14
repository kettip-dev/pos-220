import React from "react";
import { createPortal } from "react-dom";
import {
  IconDotsVertical,
  IconRefresh,
  IconSettings,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconX,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Menu, Transition } from "@headlessui/react";
import { iconStroke } from "../config/config";

/**
 * WidgetShell — the universal chrome around every widget.
 *
 * Fullscreen renders via a React portal directly into <body> so it
 * escapes react-grid-layout's transform stacking context (which would
 * otherwise clip a position:fixed child to the grid cell).
 */
export default class WidgetShell extends React.Component {
  state = { hasError: false, error: null, fullscreen: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[widget error]", this.props.descriptor?.type, error, info);
  }

  toggleFullscreen = () => this.setState((s) => ({ fullscreen: !s.fullscreen }));

  renderBody(headerSlot) {
    const { hasError, error } = this.state;
    return (
      <>
        {headerSlot}
        <div className="widget-body relative flex-1 overflow-auto p-4">
          {hasError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <IconAlertTriangle className="text-amber-500" size={28} stroke={iconStroke} />
              <p className="text-sm font-bold text-foreground">Widget couldn't load</p>
              <p className="text-xs text-restro-text">{String(error?.message || "Unexpected error")}</p>
            </div>
          ) : (
            this.props.children
          )}
        </div>
      </>
    );
  }

  renderHeader() {
    const {
      descriptor, editMode, onRemove, onConfigure, onRefresh, isRefreshing,
    } = this.props;
    const { fullscreen } = this.state;
    const Icon = descriptor?.icon;

    return (
      <div
        className={`widget-drag-handle flex items-center justify-between gap-2 border-b border-restro-border-green px-4 py-2.5 ${editMode ? "cursor-move" : ""}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={16} stroke={iconStroke} className="text-restro-text shrink-0" />}
          <h3 className="truncate text-sm font-bold text-foreground">
            {descriptor?.title || "Widget"}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {descriptor?.refreshable && onRefresh && !editMode && (
            <button
              type="button" onClick={onRefresh} title="Refresh"
              className="rounded-md p-1 text-restro-text hover:bg-restro-bg-gray hover:text-foreground transition"
            >
              <IconRefresh size={15} stroke={iconStroke} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}

          {descriptor?.fullscreenable && !editMode && (
            <button
              type="button" onClick={this.toggleFullscreen}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="rounded-md p-1 text-restro-text hover:bg-restro-bg-gray hover:text-foreground transition"
            >
              {fullscreen ? <IconArrowsMinimize size={15} stroke={iconStroke} /> : <IconArrowsMaximize size={15} stroke={iconStroke} />}
            </button>
          )}

          {!editMode && (descriptor?.configSchema?.length || 0) > 0 && (
            <Menu as="div" className="relative">
              <Menu.Button className="rounded-md p-1 text-restro-text hover:bg-restro-bg-gray hover:text-foreground transition">
                <IconDotsVertical size={15} stroke={iconStroke} />
              </Menu.Button>
              <Transition
                enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-1 w-44 origin-top-right rounded-xl border border-restro-border-green bg-background py-1 shadow-lg focus:outline-none">
                  {onConfigure && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={onConfigure}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold ${active ? "bg-restro-bg-gray" : ""}`}
                        >
                          <IconSettings size={14} stroke={iconStroke} /> Configure
                        </button>
                      )}
                    </Menu.Item>
                  )}
                </Menu.Items>
              </Transition>
            </Menu>
          )}

          {editMode && onRemove && (
            <button
              type="button" onClick={onRemove} onMouseDown={(e) => e.stopPropagation()}
              title="Remove widget"
              className="rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              <IconX size={15} stroke={iconStroke} />
            </button>
          )}
        </div>
      </div>
    );
  }

  render() {
    const { descriptor } = this.props;
    const { fullscreen } = this.state;
    const header = this.renderHeader();

    if (fullscreen) {
      // Render an empty placeholder in the grid cell + the real widget
      // in a portaled fullscreen modal. This way `children` is mounted
      // only once (no duplicated chart instances).
      return (
        <>
          <div
            className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-restro-border-green bg-restro-bg-gray/30 text-xs text-restro-text"
            data-widget-type={descriptor?.type}
          >
            Showing in fullscreen…
          </div>
          {createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
              <div className="absolute inset-0" onClick={this.toggleFullscreen} />
              <div
                className="relative flex h-full w-full max-w-7xl flex-col rounded-2xl border border-restro-border-green bg-background shadow-2xl overflow-hidden"
                data-widget-type={descriptor?.type}
              >
                {this.renderBody(header)}
              </div>
            </div>,
            document.body
          )}
        </>
      );
    }

    return (
      <div
        className="flex h-full w-full flex-col rounded-2xl border border-restro-border-green bg-background overflow-hidden transition-shadow hover:shadow-md"
        data-widget-type={descriptor?.type}
      >
        {this.renderBody(header)}
      </div>
    );
  }
}
