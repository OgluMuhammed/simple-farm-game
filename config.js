// Global Configuration Settings for Multiplayer Farm Tycoon
window.GAME_CONFIG = {
    // Grid Dimensions
    GRID_SIZE: 50,              // Width and height of the farm field (e.g., 50x50)
    
    // Base Tile Visual Dimensions (Before Zoom)
    BASE_TILE_WIDTH: 100,
    BASE_TILE_HEIGHT: 50,
    
    // Zoom Constraints
    ZOOM: {
        INITIAL: 1.0,           // Default zoom level on login
        MIN: 0.15,              // Maximum bird's-eye view out
        MAX: 2.5,               // Maximum close-up precision view
        INTENSITY: 0.08         // How fast the camera zooms per scroll wheel click
    },
    
    // Visual Styles & Colors
    COLORS: {
        DIRT_EMPTY: "#8b5a2b",  // Default brown ground color
        SPROUT_GROWING: "#cd853f", // Orange tint during growth cycle
        HARVEST_READY: "#2e8b57",  // Rich green when ready to harvest
        TILE_BORDER: "#6d421e"  // Line color around diamonds
    },
    
    // Input Tolerances
    INPUT: {
        DRAG_THRESHOLD: 8       // Pixels a pointer must slide before disabling tile selection
    }
};