export const PREVIEW_PROCEDURE = "preview_environment";

export const BASE_DEMO_SOURCE = `procedure preview_environment()
    call create_namespace()
    call create_database()
    call seed_preview_data()
    call deploy_application()
    call attach_preview_url()`;

export const DEMO_SOURCE = `procedure preview_environment()
    call create_namespace()
    call create_database()
    call create_cache()
    call seed_preview_data()
    call deploy_application()
    call attach_preview_url()`;

export const AI_ADDED_LINE = "    call create_cache()";
