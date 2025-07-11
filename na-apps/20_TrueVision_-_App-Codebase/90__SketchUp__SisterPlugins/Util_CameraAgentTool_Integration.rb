# =============================================================================
# VALEDESIGNSUITE - CAMERA AGENT TOOL INTEGRATION
# =============================================================================
#
# FILE       :  Util_CameraAgentTool_Integration.rb
# NAMESPACE  :  ValeDesignSuite::Utils::CameraAgentTool
# MODULE     :  CameraAgentTool
# AUTHOR     :  Adam Noble - Noble Architecture
# PURPOSE    :  SketchUp UI integration for Camera Agent Tool
# CREATED    :  2025
#
# DESCRIPTION:
# - This script handles the integration of Camera Agent Tool into SketchUp UI.
# - Adds menu items and toolbar buttons for easy access to the tool.
# - Should be loaded by the main ValeDesignSuite plugin.
# - Provides standalone access to the camera agent placement functionality.
#
# =============================================================================

require_relative 'Util_CameraAgentTool_MainPluginScript'

module ValeDesignSuite
    module Utils
        module CameraAgentTool

# -----------------------------------------------------------------------------
# REGION | UI Integration Functions
# -----------------------------------------------------------------------------

    # FUNCTION | Add Menu Item to Extensions Menu
    # ------------------------------------------------------------
    def self.add_menu_item
        # Create command for the tool
        cmd = UI::Command.new("Camera Agent Tool") {
            show_dialog                                                      # <-- Show tool dialog
        }
        
        # Set command properties
        cmd.tooltip = "Place and configure camera agents for virtual tours"  # <-- Tool tip
        cmd.status_bar_text = "Opens the Camera Agent Tool for placing waypoint cameras"  # <-- Status text
        cmd.menu_text = "Vale Camera Agent Tool"                            # <-- Menu text
        
        # Set icons if available
        icons_path = File.join(File.dirname(__FILE__), "..", "Assets_PluginAssets", "Icons_ValeIcons")
        small_icon = File.join(icons_path, "CameraAgent_Icon16px.png")      # <-- Small icon path
        large_icon = File.join(icons_path, "CameraAgent_Icon32px.png")      # <-- Large icon path
        
        # Only set icons if files exist
        if File.exist?(small_icon) && File.exist?(large_icon)
            cmd.small_icon = small_icon                                      # <-- Set small icon
            cmd.large_icon = large_icon                                      # <-- Set large icon
        end
        
        # Add to Extensions menu
        submenu = UI.menu("Extensions").add_submenu("Vale Design Suite")     # <-- Get or create submenu
        submenu.add_separator                                                # <-- Add separator
        submenu.add_item(cmd)                                                # <-- Add command
        
        return cmd                                                           # <-- Return command for toolbar
    end
    # ---------------------------------------------------------------

    # FUNCTION | Create Toolbar for Camera Agent Tool
    # ------------------------------------------------------------
    def self.create_toolbar
        # Create toolbar
        toolbar = UI::Toolbar.new("Camera Agent Tool")                      # <-- Create toolbar
        
        # Add command to toolbar
        cmd = add_menu_item                                                  # <-- Get command from menu
        toolbar.add_item(cmd)                                                # <-- Add to toolbar
        
        # Show toolbar
        toolbar.show                                                         # <-- Display toolbar
        
        return toolbar                                                       # <-- Return toolbar reference
    end
    # ---------------------------------------------------------------

    # FUNCTION | Initialize UI Integration
    # ------------------------------------------------------------
    def self.initialize_ui_integration
        # Add menu item
        add_menu_item                                                        # <-- Add to menu
        
        # Create toolbar (optional - can be commented out if not wanted)
        # create_toolbar                                                     # <-- Create toolbar
    end
    # ---------------------------------------------------------------

# endregion -------------------------------------------------------------------

        end # module CameraAgentTool
    end # module Utils
end # module ValeDesignSuite

# Initialize UI integration when loaded
unless file_loaded?(__FILE__)
    # Use timer to ensure SketchUp UI is ready
    UI.start_timer(0.1, false) do
        ValeDesignSuite::Utils::CameraAgentTool.initialize_ui_integration
    end
    
    file_loaded(__FILE__)
end 