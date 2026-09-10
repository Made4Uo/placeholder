// GENERATED FILE. Do not edit by hand.
// Run `npm run build:fonts` to rebuild from the @expo-google-fonts packages.
//
// 14 families, 28 faces, subset to Latin.
// Each is OFL-1.1 or Apache-2.0; see NOTICE and assets/fonts/OFL.txt.

import inter400 from "../assets/fonts/inter-regular.ttf";
import inter700 from "../assets/fonts/inter-bold.ttf";
import lato400 from "../assets/fonts/lato-regular.ttf";
import lato700 from "../assets/fonts/lato-bold.ttf";
import montserrat400 from "../assets/fonts/montserrat-regular.ttf";
import montserrat700 from "../assets/fonts/montserrat-bold.ttf";
import notoSans400 from "../assets/fonts/noto-sans-regular.ttf";
import notoSans700 from "../assets/fonts/noto-sans-bold.ttf";
import openSans400 from "../assets/fonts/open-sans-regular.ttf";
import openSans700 from "../assets/fonts/open-sans-bold.ttf";
import oswald400 from "../assets/fonts/oswald-regular.ttf";
import oswald700 from "../assets/fonts/oswald-bold.ttf";
import poppins400 from "../assets/fonts/poppins-regular.ttf";
import poppins700 from "../assets/fonts/poppins-bold.ttf";
import ptSans400 from "../assets/fonts/pt-sans-regular.ttf";
import ptSans700 from "../assets/fonts/pt-sans-bold.ttf";
import raleway400 from "../assets/fonts/raleway-regular.ttf";
import raleway700 from "../assets/fonts/raleway-bold.ttf";
import roboto400 from "../assets/fonts/roboto-regular.ttf";
import roboto700 from "../assets/fonts/roboto-bold.ttf";
import sourceSans400 from "../assets/fonts/source-sans-regular.ttf";
import sourceSans700 from "../assets/fonts/source-sans-bold.ttf";
import lora400 from "../assets/fonts/lora-regular.ttf";
import lora700 from "../assets/fonts/lora-bold.ttf";
import playfair400 from "../assets/fonts/playfair-regular.ttf";
import playfair700 from "../assets/fonts/playfair-bold.ttf";
import jetbrainsMono400 from "../assets/fonts/jetbrains-mono-regular.ttf";
import jetbrainsMono700 from "../assets/fonts/jetbrains-mono-bold.ttf";

/** Every face, in the order the renderer should consider them. */
export const FONT_BUFFERS: ArrayBuffer[] = [inter400, inter700, lato400, lato700, montserrat400, montserrat700, notoSans400, notoSans700, openSans400, openSans700, oswald400, oswald700, poppins400, poppins700, ptSans400, ptSans700, raleway400, raleway700, roboto400, roboto700, sourceSans400, sourceSans700, lora400, lora700, playfair400, playfair700, jetbrainsMono400, jetbrainsMono700];

export interface BundledFont {
  /** What `?font=` accepts. */
  key: string;
  /** The family name inside the TTF. The renderer matches on this. */
  family: string;
  generic: "sans" | "serif" | "mono";
  /** The full CSS font-family list, bundled family first. */
  stack: string;
}

export const BUNDLED_FONTS: BundledFont[] = [
  { key: "inter", family: "Inter", generic: "sans", stack: "'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "lato", family: "Lato", generic: "sans", stack: "'Lato',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "montserrat", family: "Montserrat", generic: "sans", stack: "'Montserrat',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "noto-sans", family: "Noto Sans", generic: "sans", stack: "'Noto Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "open-sans", family: "Open Sans", generic: "sans", stack: "'Open Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "oswald", family: "Oswald", generic: "sans", stack: "'Oswald',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "poppins", family: "Poppins", generic: "sans", stack: "'Poppins',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "pt-sans", family: "PT Sans", generic: "sans", stack: "'PT Sans',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "raleway", family: "Raleway", generic: "sans", stack: "'Raleway',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "roboto", family: "Roboto", generic: "sans", stack: "'Roboto',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "source-sans", family: "Source Sans 3", generic: "sans", stack: "'Source Sans 3',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif" },
  { key: "lora", family: "Lora", generic: "serif", stack: "'Lora',Georgia,'Times New Roman',Times,serif" },
  { key: "playfair", family: "Playfair Display", generic: "serif", stack: "'Playfair Display',Georgia,'Times New Roman',Times,serif" },
  { key: "jetbrains-mono", family: "JetBrains Mono", generic: "mono", stack: "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" },
];

/**
 * The family each generic resolves to when a stack falls all the way through.
 * The renderer needs these because it has no system fonts behind them.
 */
export const GENERIC_DEFAULTS = {
  "sans": "Inter",
  "serif": "Lora",
  "mono": "JetBrains Mono"
} as const;
