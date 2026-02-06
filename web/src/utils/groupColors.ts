/**
 * Utility functions for generating consistent colors for groups
 */

// Predefined color palette for groups (similar to WhatsApp Web)
const GROUP_COLORS = [
    '#ECE5DD', // Light gray
    '#DCF8C6', // Light green
    '#FEF9C3', // Light yellow
    '#E7FFDB', // Pale green
    '#C9E4FF', // Light blue
    '#FFF4CA', // Light orange
    '#F0EFFF', // Light purple
    '#FFE5E5', // Light red
    '#E6F7FF', // Sky blue
    '#F0FFF0', // Honeydew
    '#FFF5EE', // Seashell
    '#F5F5DC', // Beige
];

/**
 * Generate a consistent color for a group based on its JID
 */
export const getGroupColor = (jid: string): string => {
    if (!jid) return GROUP_COLORS[0];
    
    // Create a hash from the JID to ensure consistent color
    let hash = 0;
    for (let i = 0; i < jid.length; i++) {
        const char = jid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use the hash to select a color from the palette
    const colorIndex = Math.abs(hash) % GROUP_COLORS.length;
    return GROUP_COLORS[colorIndex];
};

/**
 * Get text color that works well with the given background color
 */
export const getTextColor = (backgroundColor: string): string => {
    // Simple luminance calculation
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.5 ? '#111B21' : '#FFFFFF';
};

/**
 * Get border color for group based on background color
 */
export const getBorderColor = (backgroundColor: string): string => {
    const textColor = getTextColor(backgroundColor);
    return textColor === '#111B21' ? '#E9EDEF' : '#2A3942';
};

/**
 * Generate a gradient for group avatar background
 */
export const getGroupGradient = (jid: string): string => {
    const baseColor = getGroupColor(jid);
    
    return `linear-gradient(135deg, ${baseColor} 0%, ${adjustColor(baseColor, 10)} 100%)`;
};

/**
 * Adjust color brightness
 */
const adjustColor = (color: string, percent: number): string => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const adjust = (value: number) => {
        const adjusted = Math.round(value * (1 + percent / 100));
        return Math.max(0, Math.min(255, adjusted));
    };
    
    const newR = adjust(r).toString(16).padStart(2, '0');
    const newG = adjust(g).toString(16).padStart(2, '0');
    const newB = adjust(b).toString(16).padStart(2, '0');
    
    return `#${newR}${newG}${newB}`;
};
