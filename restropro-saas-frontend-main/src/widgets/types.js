/**
 * Widget descriptor type definitions (jsdoc only — this codebase is JS).
 *
 * @typedef {Object} WidgetSize
 * @property {number} w  columns wide (in current breakpoint)
 * @property {number} h  rows tall  (each row ≈ 60px by default)
 *
 * @typedef {Object} WidgetConfigField
 * @property {string} key
 * @property {"select"|"boolean"|"number"|"text"|"range"} type
 * @property {string} [label]
 * @property {Array<{value:any,label:string}>} [options]   for "select"
 * @property {*} [default]
 * @property {number} [min]                                for "number"/"range"
 * @property {number} [max]
 *
 * @typedef {Object} WidgetDescriptor
 * @property {string} type            globally-unique id (e.g. "sales.revenueTrend")
 * @property {string} category        sales|orders|kitchen|inventory|customers|ops|finance|productivity|system
 * @property {string} title
 * @property {string} [description]
 * @property {React.ComponentType} [icon]
 * @property {string} [scope]         RBAC scope required
 * @property {string} [plan]          minimum plan tier
 * @property {WidgetSize} [defaultSize]
 * @property {WidgetSize} [minSize]
 * @property {WidgetSize} [maxSize]
 * @property {WidgetConfigField[]} [configSchema]
 * @property {Object} [defaultConfig]
 * @property {React.ComponentType<{config:Object,size:WidgetSize,data:any,onConfigChange:Function}>} component
 * @property {string} [preview]       static preview image path
 * @property {string[]} [tags]
 * @property {boolean} [refreshable]
 * @property {boolean} [fullscreenable]
 *
 * @typedef {Object} LayoutItem
 * @property {string} i               stable placement id
 * @property {string} type
 * @property {Object} [config]
 * @property {Object<string,{x:number,y:number,w:number,h:number}>} layout
 *
 * @typedef {Object} DashboardLayout
 * @property {number} version
 * @property {Object<string,number>} breakpoints
 * @property {Object<string,number>} cols
 * @property {LayoutItem[]} items
 */

export const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
export const ROW_HEIGHT = 64;
export const GRID_MARGIN = [16, 16];
export const CONTAINER_PADDING = [0, 0];
