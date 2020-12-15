export function hexdump(ab, offset?, len?, opts?) {
    if (!opts) {
        opts = {};
    }
    var ui8 = new Uint8Array(
        ab.buffer || ab,
        offset || ab.byteOffset,
        len || ab.byteLength
    );
    var bytecount = 0;
    var head = "        0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F";
    var trail;
    var str = [].slice
        .call(ui8)
        .map(function (i) {
            var h = i.toString(16);
            if (h.length < 2) {
                h = "0" + h;
            }
            return h;
        })
        .join("")
        .match(/.{1,2}/g)
        .join(" ")
        .match(/.{1,48}/g)
        .map(function (str) {
            var lead = bytecount.toString(16);
            bytecount += 16;

            while (lead.length < 7) {
                lead = "0" + lead;
            }

            while (str.length < 48) {
                str += " ";
            }

            if (opts.C) {
                return (
                    lead +
                    " " +
                    str +
                    " |" +
                    str
                        .replace(/ /g, "")
                        .match(/.{1,2}/g)
                        .map(function (ch) {
                            var c = String.fromCharCode(parseInt(ch, 16));
                            if (!/[ -~]/.test(c)) {
                                c = ".";
                            }
                            return c;
                        })
                        .join("") +
                    "|"
                );
            } else {
                return lead + " " + str;
            }
        })
        .join("\n");

    trail = (len || ab.byteLength).toString(16);
    while (trail.length < 7) {
        trail = "0" + trail;
    }
    return head + "\n" + str + "\n" + trail;
}
