import { setGlobalOptions } from "firebase-functions";

import { lookupSerpApiProduct } from "./serpapiLookup";
import { lookupUPCItemDB } from "./upcitemdbLookup";

setGlobalOptions({ maxInstances: 10 });

export {
  lookupSerpApiProduct,
  lookupUPCItemDB,
};
