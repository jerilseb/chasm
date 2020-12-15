import { runtime } from "./src/compiler.ts";

let tick = await runtime("print 323", {
    print: value => {
        console.log(value);
    },
});

tick();
