export const DEMO_SOURCE = `procedure deploy()
    call create_network()
    call create_database()
    call deploy_application()`;

export const demoPlan = [
  "create_network",
  "create_database",
  "deploy_application",
] as const;

export type DemoStep = (typeof demoPlan)[number];
