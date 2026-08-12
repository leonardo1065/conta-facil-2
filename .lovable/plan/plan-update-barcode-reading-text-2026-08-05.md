# Plan - Update Barcode Reading Text

The user requested to change the text "language selector" to "precisa acertar a leitura do codigo de barras". Since "language selector" does not exist in the codebase, I will update the barcode/Pix feature description on the landing page to reflect this specific phrasing, as it seems to be a note or status update regarding that feature.

## Proposed Changes

### Frontend Edits

#### `src/routes/index.tsx`
- Change the `texto` for the "Boleto e Pix" resource to "precisa acertar a leitura do codigo de barras".

## Verification Plan

### Automated Tests
- Check if the text "precisa acertar a leitura do codigo de barras" exists in `src/routes/index.tsx`.

### Manual Verification
- Open the preview and verify the landing page feature description.
