(function (GLOBAL) {
    GLOBAL.AsciiTracer = {
        buildCanvas:    function (parent, width, height) {
            var can = GLOBAL.document.createElement("canvas");
            can.width = width;
            can.height = height;
            parent.appendChild(can);
            return can.getContext("2d");
        },
        writeImage:    function (scene, ctx, width, height) {
            var palette = '0Oo:. '.split('');
            //var palette = '@$Oo:. '.split('');
            var div = $('#screen');
            var htmlContent = ['<pre>'];

            this.prepareScene(scene);
            var aspectRatio = width / height;
            var idx=1;
            var n = width * height;
            var height_inv = 1.0 / height;
            var width_inv = 1.0 / width;

            for (var i = 0; i < n; i++) {
                var y = Math.floor(i/width); 
                var x = (i % width) + 1;

                var yRec = (-y * height_inv) + 0.5;
                var xRec = ((x * width_inv) - 0.5) * aspectRatio;
                var chans = this.plotPixel(scene, xRec, yRec);

                var bright = Math.floor((palette.length-1) *(Math.floor(chans[0] * 255) / 255));

                if ((i % width) == 0) {
                    htmlContent[idx++] = '\n';
                }

                htmlContent[idx++] = palette[bright];// using a % also looks cool
            }
            htmlContent[idx++] = '</pre>';
            div.html(htmlContent.join(''));
        },
        vectorAdd:    function (v1, v2) {
            return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v1[2]];
        },
        vectorSub:    function (v1, v2) {
            return [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]];
        },
        vectorNeg:    function (v1) {
            return [-v1[0], -v1[1], -v1[2]];
        },
        vectorScale:    function (v1, x) {
            return [v1[0]*x, v1[1]*x, v1[2]*x];
        },
        vectorDot:    function (v1, v2) {
            return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
        },
        vectorCross3:    function (v1, v2) {
            return [v1[1] * v2[2] - v1[2] * v2[1],
                    v1[2] * v2[0] - v1[0] * v2[2],
                    v1[0] * v2[1] - v1[1] * v2[0]];
        },
        vectorBlend:    function (v1, v2) {
            return [v1[0]*v2[0], v1[1]*v2*[1], v1[2]*v2[2]];
        },
        vectorLength:    function (v1) {
            return Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2]);
        },
        vectorNormalise:    function (v1) {
            var fact = 1.0 / Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2]);
            return [v1[0]*fact, v1[1]*fact, v1[2]*fact];
        },
        vectorAdd:  function(v1, v2) {
            return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]];
        },
        vectorSum:    function () {
            var vecs = [];
            for (var i = 0; i < arguments.length; i++) vecs.push(arguments[i]);
            return this.vectorSumArray(vecs);
        },
        vectorSumArray:    function (vecs) {
            var res = [0,0,0];
            for (var i = 0; i < vecs.length; i++) {
                var v = vecs[i];
                res[0] += v[0];
                res[1] += v[1];
                res[2] += v[2];
            }
            return res;
        },
        plotPixel:    function (scene, x, y) {
            var cam = scene.camera;
            var raySrc = cam.position;
            var rayDir = this.vectorNormalise(
                    this.vectorAdd(
                        cam.forward, 
                        this.vectorAdd(this.vectorScale(cam.right, x), this.vectorScale(cam.up, y))
                    )
            );
            var chans = this.traceRay(scene, raySrc, rayDir, null, 1);
            for (var i = 0; i < chans.length; i++) {
                if (chans[i] < 0) chans[i] = 0;
                else if (chans[i] > 1) chans[i] = 1;
            }
            return chans;
        },
        shapeIntersect:    function (start, dir, shape) {
            switch (shape.type) {
                case 0:
                    return this.intersectPlane(start, dir, shape);
                case 1:
                    return this.intersectSphere(start, dir, shape);
                default:
                    return [];
            };
        },
        intersectPlane:    function (start, dir, plane) {
            var denom = this.vectorDot(dir, plane.normal);
            if (denom == 0) return;
            var res = plane.offset - this.vectorDot(start, plane.normal) / denom;
            if (res <= 0) return;
            return res;
        },
        intersectSphere:    function (start, dir, sphere) {
            var y = this.vectorSub(start, sphere.centre);
            var beta = this.vectorDot(dir, y),
                gamma = this.vectorDot(y, y) - sphere.radius * sphere.radius;
            var descriminant = beta * beta - gamma;
            if (descriminant <= 0) return;
            var sqrt = Math.sqrt(descriminant);
            if (-beta - sqrt > 0) return -beta - sqrt;
            else if (-beta + sqrt > 0) return -beta + sqrt;
            else return;
        },
        shapeNormal:    function (pos, shape) {
            switch (shape.type) {
                case 0:
                    return shape.normal;
                case 1:
                    return this.sphereNormal(pos, shape);
                default:
                    return [];
            };
        },
        sphereNormal:    function (pos, sphere) {
            return this.vectorScale(this.vectorSub(pos, sphere.centre), 1/sphere.radius);
        },
	    shade:    function (pos, dir, shape, scene, contrib) {
            var mat = this.material(shape.surface, pos);
            var norm = this.shapeNormal(pos, shape);
            var reflect = mat[3];
            contrib = contrib * reflect;
            norm = (this.vectorDot(dir, norm) > 0) ? -norm : norm;
            var reflectDir = this.vectorSub(dir, this.vectorScale(norm, 2 * this.vectorDot(norm, dir)));
            var light = this.light(scene, shape, pos, norm, reflectDir, mat);
            if (contrib > 0.1) { // 0.01
                return this.vectorSum(
                    light,
                    this.vectorScale(
                        this.traceRay(scene, pos, reflectDir, shape, contrib),
                        reflect
                    )
                );
            }
            else {
                return light;
            }
        },
        light:    function (scene, shape, pos, norm, reflectDir, mat) {
            var color = [mat[0],mat[1],mat[2]],
                reflect = mat[3],
                smooth = mat[4];
            var res = [];
            for (var i = 0; i < scene.lights.length; i++) {
                var lCol = scene.lights[i].color,
                    lPos = scene.lights[i].position;

                var lDir = [];
                lDir[0] = lPos[0] - pos[0];
                lDir[1] = lPos[1] - pos[1];
                lDir[2] = lPos[2] - pos[2];
                var lDist = Math.sqrt(lDir[0]*lDir[1]+lDir[1]*lDir[1]+lDir[2]*lDir[2]);
                var fact = 1.0 / lDist;
                lDir[0] *= fact;
                lDir[1] *= fact;
                lDir[2] *= fact;

                var tRay = this.testRay(scene, pos, lDir, shape);
                var skip = false;
                for (var j = 0; j < tRay.length; j++) if (tRay[j] < lDist) skip = true; // XXX use label
                if (skip) continue;
                var illum = this.vectorDot(lDir, norm);
                if (illum > 0) res.push(this.vectorScale(this.vectorBlend(lCol, color), illum));
                var spec = this.vectorDot(lDir, reflectDir);
                if (spec > 0) res.push(this.vectorScale(lCol, Math.pow(spec, smooth) * reflect));
            }
            return this.vectorSumArray(res);
        },
        material:    function (name, pos) {
            switch(name) {
                case 0:
                    return [1, 1, 1, 0.6, 50];
                case 1:
                    return ((Math.floor(pos[0]) + Math.floor(pos[2])) % 2) == 0 ?
                            [0, 0, 0, 0.7, 150] :
                            [1, 1, 1, 0.1, 50];

            }
            return;
        },
        testRay:    function (scene, src, dir, curShape) {
            var res = [];
            for (var i = 0; i < scene.shapes.length; i++) {
                var shape = scene.shapes[i];
                if (shape.id == curShape.id) continue;
                var inter = this.shapeIntersect(src, dir, shape);
                if (inter != null) res.push(inter);
            }
            return res;
        },        
        traceRay:    function (scene, src, dir, ignore, contrib) {
            var tmp = [];
            for (var i = 0; i < scene.shapes.length; i++) {
                var shape = scene.shapes[i];
                if (ignore && ignore.id == shape.id) continue;
                var dist = this.shapeIntersect(src, dir, shape);
                if (dist == null) continue; // XXX optimisation
                var pos = this.vectorAdd(src, this.vectorScale(dir, dist));
                tmp.push({dist: dist, pos: pos, shape: shape});
            }
            if (tmp.length == 0) return scene.background;
            else {
                tmp = tmp.sort(function (a, b) { return a.dist - b.dist; });
                return this.shade(tmp[0].pos, dir, tmp[0].shape, scene, contrib);
            }
        },
        calculateBasis:    function (scene) {
            var cam = scene.camera;
            cam.forward = this.vectorNormalise(this.vectorSub(cam.lookAt, cam.position));
            cam.right = this.vectorNormalise(this.vectorCross3(cam.forward, [0, -1, 0]));
            cam.up = this.vectorCross3(cam.forward, cam.right);
        },
        prepareScene:    function (scene) {
            this.calculateBasis(scene);
        },
        traceTo:    function (parent, width, height, scene) {
            this.writeImage(scene, null, width, height);
        },
    };
})(this);
