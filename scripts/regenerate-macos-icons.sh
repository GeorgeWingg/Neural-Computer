#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/src-tauri/icons"
SOURCE_ICON="${1:-$OUT_DIR/icon-source-macos-rounded.png}"
LOGO_SVG="$ROOT_DIR/public/logo-mark.svg"
INSET_SCALE="${MACOS_ICON_INSET_SCALE:-84}"
USE_VECTOR_SOURCE="${MACOS_ICON_USE_VECTOR_SOURCE:-1}"
MARK_RASTER_SIZE="${MACOS_MARK_RASTER_SIZE:-4096}"
MARK_WIDTH="${MACOS_MARK_WIDTH:-740}"
MARK_OFFSET_Y="${MACOS_MARK_OFFSET_Y:--10}"

if ! command -v magick >/dev/null 2>&1; then
  echo "error: ImageMagick (magick) is required." >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "error: iconutil is required (macOS)." >&2
  exit 1
fi

if [[ "$USE_VECTOR_SOURCE" == "1" ]] && ! command -v sips >/dev/null 2>&1; then
  echo "error: sips is required when MACOS_ICON_USE_VECTOR_SOURCE=1." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "error: source icon not found: $SOURCE_ICON" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INPUT_ICON="$SOURCE_ICON"
if [[ "$USE_VECTOR_SOURCE" == "1" ]] && [[ -f "$LOGO_SVG" ]]; then
  if [[ "$MARK_OFFSET_Y" == -* ]]; then
    MARK_GEOMETRY="+0${MARK_OFFSET_Y}"
  else
    MARK_GEOMETRY="+0+${MARK_OFFSET_Y}"
  fi

  # Preserve the rounded-square alpha from the current source icon.
  magick "$SOURCE_ICON" -alpha extract "$TMP_DIR/rounded-mask.png"

  # Use near-white RGB to keep the image in sRGB during composition.
  magick -size 1024x1024 xc:'rgb(255,254,255)' \
    "$TMP_DIR/rounded-mask.png" \
    -compose CopyOpacity \
    -composite \
    "$TMP_DIR/rounded-tile.png"

  # Rasterize the vector logo at high resolution, then isolate the colored mark.
  sips -s format png -z "$MARK_RASTER_SIZE" "$MARK_RASTER_SIZE" "$LOGO_SVG" --out "$TMP_DIR/logo-raster.png" >/dev/null
  magick "$TMP_DIR/logo-raster.png" \
    -alpha set \
    -fuzz 0.6% \
    -transparent white \
    -trim +repage \
    "$TMP_DIR/logo-mark.png"

  magick "$TMP_DIR/rounded-tile.png" \
    \( "$TMP_DIR/logo-mark.png" -filter Lanczos -resize "${MARK_WIDTH}x" \) \
    -gravity center \
    -geometry "$MARK_GEOMETRY" \
    -compose over \
    -composite \
    "$TMP_DIR/icon-source-vector.png"

  # Normalize near-white helper tone back to pure white.
  magick "$TMP_DIR/icon-source-vector.png" \
    -fuzz 0.5% \
    -fill white \
    -opaque 'rgb(255,254,255)' \
    "$TMP_DIR/icon-source-vector.png"

  INPUT_ICON="$TMP_DIR/icon-source-vector.png"
  cp "$INPUT_ICON" "$OUT_DIR/icon-source-macos-rounded.png"
fi

INSET_ICON="$TMP_DIR/icon-source-inset.png"
magick "$INPUT_ICON" \
  -filter Lanczos \
  -resize "${INSET_SCALE}%" \
  -background none \
  -gravity center \
  -extent 1024x1024 \
  "$INSET_ICON"

npx tauri icon "$INSET_ICON" -o "$TMP_DIR/icons" >/dev/null

files=(
  "32x32.png"
  "128x128.png"
  "128x128@2x.png"
  "icon.png"
  "icon.icns"
  "icon.ico"
  "StoreLogo.png"
  "Square30x30Logo.png"
  "Square44x44Logo.png"
  "Square71x71Logo.png"
  "Square89x89Logo.png"
  "Square107x107Logo.png"
  "Square142x142Logo.png"
  "Square150x150Logo.png"
  "Square284x284Logo.png"
  "Square310x310Logo.png"
)

for file in "${files[@]}"; do
  cp "$TMP_DIR/icons/$file" "$OUT_DIR/$file"
done

echo "regenerated icon assets in $OUT_DIR (macOS inset scale: ${INSET_SCALE}%, vector source: ${USE_VECTOR_SOURCE})"
