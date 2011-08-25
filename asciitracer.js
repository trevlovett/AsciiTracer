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
            // var palette = ' \u22c5\u2236\u2234\u2235\u2237\u223b\u2249\u224b\u2247'.split('').reverse();
            var palette = ' \u2591\u2592\u2593\u2588'.split('').reverse();
            var div = $('#screen');
            var htmlContent = ['<pre>'];

            this.prepareScene(scene);
            var aspectRatio = width / height;
            var idx=1;
            var n = width * height;
            var height_inv = 1.0 / height;
            var width_inv = 1.0 / width;
	        var plen = palette.length - 1;
	    
            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var yRec = (-y * height_inv) + 0.5;
                    var xRec = ((x * width_inv) - 0.5) * aspectRatio;
                    var luma = this.plotPixel(scene, xRec, yRec);

                    htmlContent[idx++] = palette[Math.floor(plen * luma)];
                }
                htmlContent[idx++] = '\n';
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
        vectorNormalize:    function (v1) {
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
            var rayDir = [];
            rayDir[0] = cam.forward[0] + x*cam.right[0] + y*cam.up[0];
            rayDir[1] = cam.forward[1] + x*cam.right[1] + y*cam.up[1];
            rayDir[2] = cam.forward[2] + x*cam.right[2] + y*cam.up[2];
            var fact = 1.0 / Math.sqrt(rayDir[0]*rayDir[0] + rayDir[1]*rayDir[1] + rayDir[2]*rayDir[2]);
            rayDir[0] *= fact;
            rayDir[1] *= fact;
            rayDir[2] *= fact;

            // don't you wish we had inline functions in javascript?
            
            /*
            above code accomplishes this:
            var rayDir = this.vectorNormalize(
                    this.vectorAdd(
                        cam.forward, 
                        this.vectorAdd(this.vectorScale(cam.right, x), this.vectorScale(cam.up, y))
                    )
            );
            */

            var luma = this.traceRay(scene, cam.position, rayDir, null, 1);
            if (luma < 0) luma = 0;
            else if (luma > 1.0) luma = 1.0;
            return luma;
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
            var denom = dir[0]*plane.normal[0] + dir[1]*plane.normal[1] + dir[2]*plane.normal[2]; //this.vectorDot(dir, plane.normal);
            if (denom == 0) return;
            //var res = plane.offset - this.vectorDot(start, plane.normal) / denom;
            var res = plane.offset - (start[0]*plane.normal[0] + start[1]*plane.normal[1] + start[2]*plane.normal[2]) / denom;
            if (res <= 0) return;
            return res;
        },
        intersectSphere:    function (start, dir, sphere) {
            /*
            var y = this.vectorSub(start, sphere.centre);
            var beta = this.vectorDot(dir, y),
                gamma = this.vectorDot(y, y) - sphere.radius * sphere.radius;
            */
            var y = [];
            y[0] = start[0] - sphere.centre[0];
            y[1] = start[1] - sphere.centre[1];
            y[2] = start[2] - sphere.centre[2];
            var beta = dir[0]*y[0] + dir[1]*y[1] + dir[2]*y[2];
            var gamma = y[0]*y[0] + y[1]*y[1] + y[2]*y[2] - sphere.radius*sphere.radius;

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
            //return this.vectorScale(this.vectorSub(pos, sphere.centre), 1/sphere.radius);
            var fact = 1.0 / sphere.radius;
            return [fact*(pos[0] - sphere.centre[0]), fact*(pos[1] - sphere.centre[1]), fact*(pos[2] - sphere.centre[2])];
        },
	    shade:    function (pos, dir, shape, scene, contrib) {
            var mat = this.material(shape.surface, pos);
            var norm = this.shapeNormal(pos, shape);
            var reflect = mat[1];
            var dirDotNorm = dir[0]*norm[0] + dir[1]*norm[1] + dir[2]*norm[2];
            var _2dirDotNorm = 2*dirDotNorm;

            contrib = contrib * reflect;

            //norm = (this.vectorDot(dir, norm) > 0) ? -norm : norm;
            norm = (dirDotNorm > 0) ? -norm: norm;

            //var reflectDir = this.vectorSub(dir, this.vectorScale(norm, 2 * this.vectorDot(norm, dir)));
            var reflectDir = [];
            reflectDir[0] = dir[0] - _2dirDotNorm*norm[0];
            reflectDir[1] = dir[1] - _2dirDotNorm*norm[1];
            reflectDir[2] = dir[2] - _2dirDotNorm*norm[2];

            var light = this.light(scene, shape, pos, norm, reflectDir, mat);
            if (contrib > 0.1) { // 0.01
                return light + reflect * this.traceRay(scene, pos, reflectDir, shape, contrib);
            }
            else {
                return light;
            }
        },
        light:    function (scene, shape, pos, norm, reflectDir, mat) {
            var color = mat[0],
                reflect = mat[1],
                smooth = mat[2];
            var res = 0;
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
                for (var j = 0; j < tRay.length; j++) {
                    if (tRay[j] < lDist) {
                        skip = true; // XXX use label
                        break;
                    }
                }
                if (skip) continue;
                var illum = lDir[0]*norm[0] + lDir[1]*norm[1] + lDir[2]*norm[2]; //this.vectorDot(lDir, norm);
                if (illum > 0) res += lCol * color * illum; 
                var spec = lDir[0]*reflectDir[0] + lDir[1]*reflectDir[1] + lDir[2]*reflectDir[2]; //this.vectorDot(lDir, reflectDir);
                if (spec > 0) res += lCol * Math.pow(spec, smooth) * reflect; 
            }
            return res;
        },
        material:    function (name, pos) {
            switch(name) {
                case 0:
                    return [1, 0.6, 50];
                case 1:
                    return ((Math.floor(pos[0]) + Math.floor(pos[2])) % 2) == 0 ?
                            [0, 0.7, 150] :
                            [1, 0.1, 50];
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
                //var pos = this.vectorAdd(src, this.vectorScale(dir, dist));
                var pos = [src[0] + dist*dir[0], src[1] + dist*dir[1], src[2] + dist*dir[2]];
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
            cam.forward = this.vectorNormalize(this.vectorSub(cam.lookAt, cam.position));
            cam.right = this.vectorNormalize(this.vectorCross3(cam.forward, [0, -1, 0]));
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
