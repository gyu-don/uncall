import appBundle from "../generated/app.js.txt";
import quantumAppBundle from "../generated/quantum-app.js.txt";
import { createWorker } from "./worker";

export default createWorker(appBundle, quantumAppBundle);
