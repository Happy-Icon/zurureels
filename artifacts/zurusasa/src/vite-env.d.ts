/// <reference types="vite/client" />

declare module "*.asset.json" {
  const value: {
    version: number;
    asset_id: string;
    project_id: string;
    url: string;
    original_filename: string;
    size: number;
    created_at: string;
  };
  export default value;
}
