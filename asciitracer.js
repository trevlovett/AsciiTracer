var AsciiTracer = 
{
        init: function(width, height)
        {
                self.palette = ' .:;!?1OC&@XEBW#\u2591\u2591\u2591\u2592\u2592\u2592\u2592\u2592\u2593\u2593\u2593\u2593\u2593\u2588'; 
                
                self.palette = self.palette.split('').reverse();
                self.plen = self.palette.length - 1;
                self.width = width;
                self.height = height;
                self.aspectRatio = width / height;
                self.height_inv = 1.0 / height;
                self.width_inv = 1.0 / width;
                self.xincr = 0.5 / width;
                self.yincr = 0.5 / height;
                                                
                var r_idx = 0;

                self.rows = [];
                
                var ylt = self.ylut = [];
                var xlt = self.xlut = [];
                
                for(var y = 0; y < height; y++) 
                {
                        var r = self.rows[r_idx] = [];

                        for(var x = 0; x < width; x++) 
                                r[x] = 0.0;

                        r_idx++;
                }
                
                for(var y = 0; y < self.height; y++) 
                        ylt[y] = (-y * self.height_inv) + 0.5;
                                
                for (var x = 0; x < self.width; x++) 
                        xlt[x] = ((x * self.width_inv) - 0.5) * self.aspectRatio;
                
                var html = ['<pre>'];
                var idx = 1;
                
                for(var y = 0; y < height; y++) 
                {
                        for(var x = 0; x < width; x++)
                                html[idx++] = '?';

                        html[idx++] = '\n';
                }
                
                html[idx] = '</pre>';
                
                $('#screen').html(html.join(''));
                $('#fps').html('&nbsp;0.00&nbsp;');
        },
                
        writeImage: function(scene, ctx, width, height) 
        {
                var html = ['<pre>'];
                var idx = 1;
                
                this.prepareScene(scene);

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
                                var v = this.plotPixel(scene, xl, yl);
                                
                                if(aa)
                                {
                                        var t = this.plotPixel(scene, xl, yl - yincr);
                                        
                                        t += this.plotPixel(scene, xl - xincr, yl + yincr);
                                        t += this.plotPixel(scene, xl + xincr, yl + yincr);
                                        
                                        v = (v * 0.5) + (t * div6);
                                }
                
                                if(mb > 0)
                                        v = (r[x] * mb) + (v * mb_inv);
                                
                                var c = Math.round(v * plen);
                                
                                if(c > -1 && c < plen)
                                        html[idx++] = p[c]
                                else
                                        html[idx++] = ' ';
                                
                                r[x] = v;
                        }

                        html[idx++] = '\n';
                }

                html[idx] = '</pre>';
                $('#screen').html(html.join(''));
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
        
        vectorScale: function(v1, x) 
        {
                return [v1[0]*x, v1[1]*x, v1[2]*x];
        },
        
        vectorDot: function(v1, v2) 
        {
                return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
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
        
        plotPixel: function (scene, x, y) 
        {
                var cam = scene.camera;
                var cf = cam.forward, cr = cam.right, cu = cam.up;
                var rayDir = [cf[0] + x*cr[0] + y*cu[0],
                        cf[1] + x*cr[1] + y*cu[1],
                        cf[2] + x*cr[2] + y*cu[2]];

                var d = this.vectorLength(rayDir);
                var fact = 1.0;
                
                if(d > 0.0)
                        fact /= d;

                rayDir[0] *= fact;
                rayDir[1] *= fact;
                rayDir[2] *= fact;
                
                scene.level = 0;
                
                return this.traceRay(scene, cam.position, rayDir, null, 1);
        },
        
        shade: function(pos, dir, shape, scene, contrib)
        {
                var luma = null;
                var reflect = null;
                var smooth = null;

                switch(shape.surface) 
                {
                    case 0:
                        luma = 1;
                        reflect = 0.63;
                        smooth = 100;
                        break;
                    case 2:
                        var r = [pos[0] - shape.centre[0], pos[1] - shape.centre[1], pos[2] - shape.centre[2]];
                        var r_fact = 1.0 / shape.radius; 

                        // sphere
                        if (shape.type == 1 && shape.textureBuffer) 
                        {
                            var u = r[0] * r_fact;
                            var v = r[1] * r_fact;

                            // adding width and height to take care of neg (u, v) coords
                            var u_off = Math.floor(shape.textureWidth + u * shape.textureWidth) % shape.textureWidth;
                            var v_off = Math.floor(shape.textureHeight + v * shape.textureHeight) % shape.textureHeight;
                            var offset = v_off*shape.textureWidth + u_off;
                            
                            // TODO: store textures as float arrays
                            luma = shape.textureBuffer[offset] / 255;
                            break;
                        }
                        // plane
                        else if (shape.type == 0) 
                        {
                           // TODO plane tex mapping 
                           break;
                        }
                    case 1:
                        if(Math.abs(pos[0]) < 10 && Math.abs(pos[2]) < 10 && (Math.round(pos[0]) + Math.round(pos[2])) % 2 == 0)
                        {
                            luma = 1;
                            reflect = 0;
                            smooth = 0;
                        }
                        else {
                            luma = 0;
                            reflect = 0;
                            smooth = 0;
                        }
                        break;
                }
                
                var norm = shape.type == 0 ? shape.normal : shape.type == 1 ? this.vectorScale(this.vectorSub(pos, shape.centre), 1.0 / shape.radius) : [0, 0, 0];
                var dirDotNorm = dir[0]*norm[0] + dir[1]*norm[1] + dir[2]*norm[2];
                var _2dirDotNorm = 2*dirDotNorm;

                contrib = contrib * reflect;

                norm = (dirDotNorm > 0) ? -norm: norm;

                var reflectDir = [];
                
                reflectDir[0] = dir[0] - _2dirDotNorm*norm[0];
                reflectDir[1] = dir[1] - _2dirDotNorm*norm[1];
                reflectDir[2] = dir[2] - _2dirDotNorm*norm[2];

                var light = 0;

                for(var i = 0; i < scene.lights.length; i++) 
                {
                        var lLuma = scene.lights[i].luma;
                        var lPos = scene.lights[i].position;
                        var lDir = [lPos[0] - pos[0],
                                lPos[1] - pos[1],
                                lPos[2] - pos[2]];

                        var lDist = Math.sqrt((lDir[0]*lDir[0]) + (lDir[1]*lDir[1]) + (lDir[2]*lDir[2])); 
                        var fact = 1.0;

                        if(lDist > 0.0)
                        {
                                fact /= lDist;
                                
                                lDir[0] *= fact;
                                lDir[1] *= fact;
                                lDir[2] *= fact;
                        }

                        var illum = this.vectorDot(lDir, norm);

                        if(illum > 0)
                                light += lLuma * luma * illum;
                        
                        if(reflect > 0)
                        {
                                var spec = this.vectorDot(lDir, reflectDir);

                                if(spec > 0)
                                        light += lLuma * Math.pow(spec, smooth) * reflect;
                        }
                }
                                
                if (contrib > 0.1)
                        light += reflect * this.traceRay(scene, pos, reflectDir, shape, contrib);

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
        
        traceRay: function (scene, src, dir, ignore, contrib) 
        {
                var tmp = null;

                scene.level++;
                
                if(scene.level > 4)
                        return;
                
                for(var i = 0; i < scene.shapes.length; i++) 
                {
                        var shape = scene.shapes[i];

                        if(ignore && ignore.id == shape.id) 
                                continue;

                        var dist = null;
                        
                        if(shape.type == 0) // plane
                        {
                                var n = shape.normal;
                                var denom = dir[0]*n[0] + dir[1]*n[1] + dir[2]*n[2];

                                if(denom != 0)
                                {
                                        var res = shape.offset - (src[0]*n[0] + src[1]*n[1] + src[2]*n[2]) / denom;

                                        if(res > 0) 
                                                dist = res;
                                } 
                        }
                        else // sphere
                        {
                                var y = [];

                                y[0] = src[0] - shape.centre[0];
                                y[1] = src[1] - shape.centre[1];
                                y[2] = src[2] - shape.centre[2];

                                var beta = dir[0]*y[0] + dir[1]*y[1] + dir[2]*y[2];
                                var gamma = y[0]*y[0] + y[1]*y[1] + y[2]*y[2] - shape.radius2;
                                var descriminant = beta * beta - gamma;

                                if (descriminant > 0)
                                {
                                        var s = Math.sqrt(descriminant);

                                        dist = -beta - s > 0 ? -beta - s : -beta + s > 0 ? -beta + s : null;
                                } 
                        }

                        if (dist == null) 
                                continue;

                        var pos = this.vectorAdd(src, this.vectorScale(dir, dist));

                        if(tmp == null || dist < tmp[0])
                                tmp = [dist, pos, shape];
                }

                if(tmp != null) 
                        return this.shade(tmp[1], dir, tmp[2], scene, contrib);

                return scene.background;
        },
        
        prepareScene: function(scene) 
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
        },
        
        traceTo: function(parent, width, height, scene) 
        {
                this.writeImage(scene, null, width, height);
        }
};
