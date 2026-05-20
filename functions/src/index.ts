import { setGlobalOptions } from "firebase-functions";

import { lookupUPCItemDB } from "./upcitemdbLookup";

setGlobalOptions({ maxInstances: 10 });

export { lookupUPCItemDB };
