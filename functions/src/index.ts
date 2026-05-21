import { setGlobalOptions } from "firebase-functions";

import { lookupAmazonItem } from "./amazonLookup";
import { lookupSerpApiProduct } from "./serpapiLookup";
import { lookupUPCItemDB } from "./upcitemdbLookup";

setGlobalOptions({ maxInstances: 10 });

export {
  lookupAmazonItem,
  lookupSerpApiProduct,
  lookupUPCItemDB
};
