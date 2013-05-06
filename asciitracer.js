var AsciiTracer =
{
        init: function(width, height)
        {
                self.palette = ' .:;!|?1OC&@XEBW#\u2591\u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2588'.split('').reverse();
                self.plen = self.palette.length - 1;
                self.width = width;
                self.height = height;
                self.xincr = 0.5 / width;
                self.yincr = 0.5 / height;
                self.frontbuffer = $('#screen');

                var ylt = self.ylut = [];
                var xlt = self.xlut = [];
                var rows = self.rows = [];
                var html = self.html = [];
                var idx = 1;
                var r_idx = 0;

                for(var y = 0; y < height; y++)
                {
                        var r = rows[r_idx] = [];

                        for(var x = 0; x < width; x++)
                                r[x] = 0.0;

                        r_idx++;
                }

                var height_inv = 1.0 / height;
                var width_inv = 1.0 / width;
                var aspect_ratio = width / height;

                for(var y = 0; y < height; y++)
                        ylt[y] = (-y * height_inv) + 0.5;

                for (var x = 0; x < width; x++)
                        xlt[x] = ((x * width_inv) - 0.5) * aspect_ratio;

                html[0] = '<pre>';

                for(var y = 0; y < height; y++)
                {
                        for(var x = 0; x < width; x++)
                                html[idx++] = '|';

                        html[idx++] = '\n';
                }

                html[idx] = '</pre>';

                self.frontbuffer.html(html.join(''));
        },

        writeImage: function(scene, width, height)
        {
                var html = self.html;
                var idx = 1;
                var mb = self.motion_blur_amount;
                var mb_inv = 1.0 - mb;
                var xlut = self.xlut;
                var ylut = self.ylut;
                var yincr = self.yincr;
                var xincr = self.xincr;
                var p = self.palette;
                var plen = self.plen;
                var w = self.width, h = self.height;
                var rows = self.rows;
                var aa = self.antialias;
                var div6 = 1.0 / 6.0;

                for(var y = 0; y < h; y++)
                {
                        var yl = ylut[y];
                        var r = rows[y];

                        for(var x = 0; x < w; x++)
                        {
                                var xl = xlut[x];
                                var v = this.sample(scene, xl, yl);

                                if(aa)
                                {
                                        var t = this.sample(scene, xl, yl - yincr);

                                        t += this.sample(scene, xl - xincr, yl + yincr);
                                        t += this.sample(scene, xl + xincr, yl + yincr);

                                        v = (v * 0.5) + (t * div6);
                                }

                                if(mb > 0)
                                        v = (r[x] * mb) + (v * mb_inv);

                                var c = Math.round(v * plen);

                                html[idx++] = c < plen ? p[c] : ' ';
                                r[x] = v;
                        }

                        idx++;
                }

                self.frontbuffer.html(html.join(''));
        },

        setAntiAlias: function(amount)
        {
                self.antialias = amount > 0.0;
        },

        setMotionBlur: function(amount)
        {
                self.motion_blur_amount = (amount < 0.0 ? 0.0 : amount > 1.0 ? 1.0 : amount) * 0.95;
        },

        vectorAdd: function(v1, v2)
        {
                return [v1[0]+v2[0], v1[1]+v2[1], v1[2]+v2[2]];
        },

        vectorSub: function(v1, v2)
        {
                return [v1[0]-v2[0], v1[1]-v2[1], v1[2]-v2[2]];
        },

        vectorRotateXY: function(v, theta)
        {
                return [v[0] * Math.cos(theta) - v[2] * Math.sin(theta),
                        v[1],
                        v[0] * Math.sin(theta) + v[2] * Math.cos(theta)]

        },

        vectorScale: function(v1, x)
        {
                return [v1[0]*x, v1[1]*x, v1[2]*x];
        },

        vectorCross3: function(v1, v2)
        {
                return [v1[1] * v2[2] - v1[2] * v2[1],
                        v1[2] * v2[0] - v1[0] * v2[2],
                        v1[0] * v2[1] - v1[1] * v2[0]];
        },

        vectorLength: function(v1)
        {
                return Math.sqrt((v1[0]*v1[0]) + (v1[1]*v1[1]) + (v1[2]*v1[2]));
        },

        vectorNormalize: function(v1)
        {
                var d = this.vectorLength(v1);
                var fact = 1.0;

                if(d > 0.0)
                        fact /= d;

                return [v1[0]*fact, v1[1]*fact, v1[2]*fact];
        },

        intersectPlane: function(start, dir, plane)
        {
                var n = plane.normal;
                var denom = dir[0]*n[0] + dir[1]*n[1] + dir[2]*n[2];

                if(denom == 0)
                        return;

                var res = plane.offset - (start[0]*n[0] + start[1]*n[1] + start[2]*n[2]) / denom;

                if(res <= 0)
                        return;

                return res;
        },

        intersectSphere: function(start, dir, sphere)
        {
                var y = [];

                y[0] = start[0] - sphere.centre[0];
                y[1] = start[1] - sphere.centre[1];
                y[2] = start[2] - sphere.centre[2];

                var beta = dir[0]*y[0] + dir[1]*y[1] + dir[2]*y[2];
                var gamma = y[0]*y[0] + y[1]*y[1] + y[2]*y[2] - sphere.radius2;
                var descriminant = beta * beta - gamma;

                if (descriminant <= 0)
                        return;

                var sqrt = Math.sqrt(descriminant);

                return -beta - sqrt > 0 ? -beta - sqrt : -beta + sqrt > 0 ? -beta + sqrt : null;
        },

        sample: function (scene, x, y)
        {
                var cam = scene.camera;
                var cf = cam.forward, cr = cam.right, cu = cam.up;
                var rayDir = [cf[0] + x * cr[0] + y * cu[0],
                              cf[1] + x * cr[1] + y * cu[1],
                              cf[2] + x * cr[2] + y * cu[2]];

                var d = this.vectorLength(rayDir);
                var fact = 1.0;

                if(d > 0.0)
                        fact /= d;

                rayDir[0] *= fact;
                rayDir[1] *= fact;
                rayDir[2] *= fact;

                return this.traceRay(scene, cam.position, rayDir, null, 1, 0);
        },

        shade: function(pos, dir, shape, scene, contrib, level)
        {
                var luma = null;
                var reflect = null;
                var smooth = null;

                if(shape.surface == 0)
                {
                        luma = 1;
                        reflect = 0.63;
                        smooth = 100;
                }
                // TODO: make constant for max plane size
                else if((Math.round(pos[0]) + Math.round(pos[2]) + Math.round(pos[1])) % 2 == 0)
                {
                        luma = 1;
                        reflect = 0;
                        smooth = 0;
                }
                else
                {
                        luma = 0;
                        reflect = 0;
                        smooth = 0;
                }

                var norm = shape.type == 0 ? shape.normal : shape.type == 1 ? this.vectorScale(this.vectorSub(pos, shape.centre), 1.0 / shape.radius) : [0, 0, 0];
                var dirDotNorm = (dir[0] * norm[0]) + (dir[1] * norm[1]) + (dir[2] * norm[2]);
                var _2dirDotNorm = 2 * dirDotNorm;

                contrib = contrib * reflect;

                norm = dirDotNorm > 0 ? -norm: norm;

                var reflectDir = [];

                reflectDir[0] = dir[0] - (_2dirDotNorm * norm[0]);
                reflectDir[1] = dir[1] - (_2dirDotNorm * norm[1]);
                reflectDir[2] = dir[2] - (_2dirDotNorm * norm[2]);

                var light = 0;
                var lights = scene.lights;

                for(var i = 0; i < lights.length; i++)
                {
                        var lLuma = lights[i].luma;
                        var lPos = lights[i].position;
                        var lDir = [lPos[0] - pos[0],
                                    lPos[1] - pos[1],
                                    lPos[2] - pos[2]];

                        var lDist = Math.sqrt((lDir[0] * lDir[0]) + (lDir[1] * lDir[1]) + (lDir[2] * lDir[2]));
                        var fact = 1.0;

                        if(lDist > 0.0)
                        {
                                fact /= lDist;

                                lDir[0] *= fact;
                                lDir[1] *= fact;
                                lDir[2] *= fact;
                        }

                        var illum = (lDir[0] * norm[0]) + (lDir[1] * norm[1]) + (lDir[2] * norm[2]);

                        if(illum > 0)
                                light += lLuma * luma * illum;

                        if(reflect > 0)
                        {
                                var spec = (lDir[0] * reflectDir[0]) + (lDir[1] * reflectDir[1]) + (lDir[2] * reflectDir[2]);

                                if(spec > 0)
                                        light += lLuma * Math.pow(spec, smooth) * reflect;
                        }
                }

                if (contrib > 0.1)
                        light += reflect * this.traceRay(scene, pos, reflectDir, shape, contrib, level);

                return light;
        },

        testRay: function (scene, src, dir, curShape)
        {
                var res = [];
                var shp = scene.shapes;

                for(var i = 0; i < shp.length; i++)
                {
                        var shape = shp[i];

                        if(shape.id == curShape.id)
                                continue;

                        var inter = scene.shape_funcs[shape.type](src, dir, shape);

                        if(inter != null)
                                res.push(inter);
                }

                return res;
        },

        traceRay: function (scene, src, dir, ignore, contrib, level)
        {
                level++;

                if(level > 4)
                        return;

                var tmp = null;
                var shp = scene.shapes;
                var sf = scene.shape_funcs = scene.shape_funcs;

                for(var i = 0; i < shp.length; i++)
                {
                        var shape = shp[i];

                        if(ignore && ignore.id == shape.id)
                                continue;

                        var dist = sf[shape.type](src, dir, shape);

                        if(dist != null && (tmp == null || dist < tmp[0]))
                                tmp = [dist, this.vectorAdd(src, this.vectorScale(dir, dist)), shape];
                }

                if(tmp != null)
                        return this.shade(tmp[1], dir, tmp[2], scene, contrib, level);

                return scene.background;
        },

        traceTo: function(width, height, scene)
        {
                var cam = scene.camera;

                cam.forward = this.vectorNormalize(this.vectorSub(cam.lookAt, cam.position));
                cam.right = this.vectorNormalize(this.vectorCross3(cam.forward, [0, -1, 0]));
                cam.up = this.vectorCross3(cam.forward, cam.right);

                // Precalc radius**2 for all spheres
                for(var i=0; i<scene.shapes.length; i++)
                {
                        var s = scene.shapes[i];

                        if(s.type == 1)
                                s.radius2 = s.radius * s.radius;
                }

                scene.shape_funcs = [this.intersectPlane, this.intersectSphere];
                this.writeImage(scene, width, height);
        }
};
