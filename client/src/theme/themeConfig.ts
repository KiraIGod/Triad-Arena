import type { ThemeConfig } from "antd";

const COLORS = {
  bg: "#0E0E0E",            // --background
  fg: "#D9C7A8",            // --foreground / --text-aged
  card: "#1A1612",          // --card
  muted: "#2A241E",         // --muted / parchment-medium
  mutedFg: "#6B625A",       // --muted-foreground
  border: "#000000",        // --border
  primary: "#D9C7A8",       // --primary
  primaryFg: "#1A1612",     // --primary-foreground
  accent: "#A83E36",        // --accent / --blood-red
  destructive: "#8B1E1E",   // --destructive
  warning: "#D97D42",       // --warning-orange
  gold: "#C9A962",          // --gold-accent
  textFaded: "#8B7E6F",     // --text-faded
};

export const themeConfig: ThemeConfig = {
  token: {
    // Brand
    colorPrimary: COLORS.primary,
    colorInfo: COLORS.primary,
    colorLink: COLORS.gold,

    // Status
    colorError: COLORS.destructive,
    colorWarning: COLORS.warning,
    // colorSuccess: можно позже подобрать “баф/хил” оттенок

    // Backgrounds
    colorBgBase: COLORS.bg,
    colorBgContainer: COLORS.card,
    colorBgElevated: COLORS.card,
    colorFillTertiary: COLORS.muted, // hover/selected surfaces
    colorFillSecondary: COLORS.muted,

    // Text
    colorText: COLORS.fg,
    colorTextSecondary: COLORS.textFaded,
    colorTextTertiary: COLORS.mutedFg,
    colorTextQuaternary: "rgba(217, 199, 168, 0.35)",

    // Borders
    colorBorder: COLORS.border,
    colorSplit: "rgba(217, 199, 168, 0.18)",

    // Typography
    fontFamily: `'Crimson Text', serif`,
    fontFamilyCode: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,

    // Radius — у тебя --radius: 0px, значит “рублено”
    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,

    // Control sizing
    controlHeight: 40,
    controlHeightLG: 44,
    controlHeightSM: 32,

    // Shadows — чтобы не было “пластика”
    boxShadow: "none",
    boxShadowSecondary: "none",
    boxShadowTertiary: "none",
  },

  components: {
    Layout: {
      headerBg: COLORS.bg,
      bodyBg: COLORS.bg,
      siderBg: COLORS.bg,
    },

    Typography: {
      titleMarginBottom: 0,
      titleMarginTop: 0,
      // сами шрифты заголовков лучше задать CSS'ом через .ant-typography h1..h5
    },

    Card: {
      colorBgContainer: COLORS.card,
      headerBg: COLORS.card,
      // AntD сам рисует border — мы его “чернильным”
      colorBorderSecondary: COLORS.border,
    },

    Button: {
      defaultBg: COLORS.card,
      defaultColor: COLORS.fg,
      defaultBorderColor: COLORS.border,

      primaryColor: COLORS.primaryFg,
      primaryShadow: "none",

      // hover/active — в твоём стиле лучше через слегка “золотой” акцент
      colorPrimaryHover: COLORS.gold,
      colorPrimaryActive: COLORS.gold,
    },

    Input: {
      colorBgContainer: COLORS.card,
      colorTextPlaceholder: "rgba(217, 199, 168, 0.45)",
      colorBorder: COLORS.border,
      activeBorderColor: COLORS.accent, // --ring
      hoverBorderColor: COLORS.gold,
    },

    Select: {
      colorBgContainer: COLORS.card,
      colorBorder: COLORS.border,
      optionSelectedBg: COLORS.muted,
    },

    Modal: {
      contentBg: COLORS.card,
      headerBg: COLORS.card,
      titleColor: COLORS.fg,
    },

    Popover: {
      colorBgElevated: COLORS.card,
    },

    Tooltip: {
      colorText: COLORS.fg,
    },

    Tabs: {
      itemColor: COLORS.textFaded,
      itemSelectedColor: COLORS.fg,
      itemHoverColor: COLORS.gold,
      inkBarColor: COLORS.gold,
    },

    Table: {
      colorBgContainer: COLORS.card,
      headerBg: COLORS.muted,
      headerColor: COLORS.fg,
      borderColor: COLORS.border,
      rowHoverBg: COLORS.muted,
    },

    Divider: {
      colorSplit: "rgba(217, 199, 168, 0.18)",
    },

    Notification: {
      colorBgElevated: COLORS.card,
    },

    Message: {
      contentBg: COLORS.card,
    },
  },
};