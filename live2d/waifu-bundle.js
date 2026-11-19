/*!
 * waifu-bundle.js — WaifuKit：core + model-size + canvas + moc2-patches + api-keys + moc3-runtime
 * 加载顺序须保持与本文件内分段一致；须在 live2d.min.js 之后执行。
 */
/**
 * WaifuKit 核心：脚本加载工具（Cubism/Pixi 懒加载用）
 */
(function (W) {
    W.loadScriptOnce = function (src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.crossOrigin = "anonymous";
            s.onload = function () {
                resolve();
            };
            s.onerror = function () {
                reject(new Error("script load failed: " + src));
            };
            document.head.appendChild(s);
        });
    };
    W.scriptBase = "";
    W.setScriptBase = function (base) {
        if (base && typeof base === "string") W.scriptBase = base.endsWith("/") ? base : base + "/";
    };
    W.getScriptBase = function () {
        return W.scriptBase || "";
    };
})(window.WaifuKit = window.WaifuKit || {});

/**
 * model_sizes 解析：ALL → 父级前缀 → 精确 key
 */
(function (W) {
    W.modelSize = {
        resolveSpec: function (modelSizes, modelKey) {
            if (!modelSizes || typeof modelSizes !== "object") return null;
            if (!modelKey || typeof modelKey !== "string") {
                return modelSizes.ALL || null;
            }
            if (modelSizes[modelKey]) return modelSizes[modelKey];
            var parts = modelKey.split("/");
            for (var n = parts.length - 1; n >= 1; n--) {
                var prefix = parts.slice(0, n).join("/");
                if (modelSizes[prefix]) return modelSizes[prefix];
            }
            return modelSizes.ALL || null;
        },
        getDimensions: function (modelSizes, modelKey) {
            var allDef = modelSizes && modelSizes.ALL;
            var defW = allDef && Number(allDef.width) > 0 ? Number(allDef.width) : 800;
            var defH = allDef && Number(allDef.height) > 0 ? Number(allDef.height) : 800;
            var spec = W.modelSize.resolveSpec(modelSizes, modelKey);
            var w = spec && Number(spec.width) > 0 ? Number(spec.width) : defW;
            var h = spec && Number(spec.height) > 0 ? Number(spec.height) : defH;
            return {
                width: w,
                height: h
            };
        }
    };
})(window.WaifuKit = window.WaifuKit || {});

/**
 * 画布尺寸：替换 canvas 节点，避免 WebGL 上下文与尺寸不一致
 */
(function (W) {
    W.canvas = {
        applyModelSize: function (canvasId, modelSizes, modelKey, forceReplace) {
            var canvas = document.getElementById(canvasId);
            if (!canvas) return;
            var dim = W.modelSize.getDimensions(modelSizes, modelKey);
            if (!forceReplace && canvas.width === dim.width && canvas.height === dim.height) return;
            var parent = canvas.parentNode;
            if (!parent) return;
            var next = document.createElement("canvas");
            next.id = canvasId;
            next.width = dim.width;
            next.height = dim.height;
            parent.replaceChild(next, canvas);
        }
    };
})(window.WaifuKit = window.WaifuKit || {});

/**
 * Cubism2 / live2d.min.js 运行时补丁（仅安装一次）
 */
(function (W) {
    if (W.moc2PatchesInstalled) return;
    W.moc2PatchesInstalled = true;

    /**
     * API 返回的 model/textures 等为完整 https URL 时，Cubism2 仍按「模型 JSON 所在目录」拼路径，
     * 会得到 /live2d_api/get/https://oss... 这类非法地址。若字符串中间出现 https:// 则截断为绝对地址。
     */
    (function patchLive2dAbsoluteAssetUrls() {
        function normalizeAssetUrl(url) {
            if (typeof url !== "string") return url;
            var i = url.indexOf("https://");
            if (i > 0) return url.slice(i);
            i = url.indexOf("http://");
            if (i > 0) {
                var tail = url.slice(i);
                if (/^https?:\/\//.test(tail)) return tail;
            }
            return url;
        }
        if (typeof XMLHttpRequest !== "undefined" && XMLHttpRequest.prototype.open && !XMLHttpRequest.prototype.open._waifuNormalizeUrl) {
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url) {
                var args = Array.prototype.slice.call(arguments);
                args[1] = normalizeAssetUrl(url);
                return origOpen.apply(this, args);
            };
            XMLHttpRequest.prototype.open._waifuNormalizeUrl = true;
        }
        if (typeof window.fetch === "function" && !window.fetch._waifuNormalizeUrl) {
            var origFetch = window.fetch;
            window.fetch = function (input, init) {
                if (typeof input === "string") input = normalizeAssetUrl(input);
                return origFetch.call(this, input, init);
            };
            window.fetch._waifuNormalizeUrl = true;
        }
        /* motion 音效等常用 Audio / src，不经 XHR */
        if (typeof window.Audio === "function" && !window.Audio._waifuNormalizeUrl) {
            var OrigAudio = window.Audio;
            window.Audio = function Audio(src) {
                if (arguments.length === 0) return new OrigAudio();
                return new OrigAudio(normalizeAssetUrl(String(arguments[0])));
            };
            try {
                Object.setPrototypeOf(window.Audio, OrigAudio);
            } catch (eA) {}
            window.Audio._waifuNormalizeUrl = true;
        }
        if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype) {
            var desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
            if (desc && desc.set && !desc.set._waifuNormalizeUrl) {
                var origSet = desc.set;
                var wrappedSet = function (v) {
                    origSet.call(this, normalizeAssetUrl(typeof v === "string" ? v : String(v)));
                };
                wrappedSet._waifuNormalizeUrl = true;
                Object.defineProperty(HTMLMediaElement.prototype, "src", {
                    configurable: desc.configurable,
                    enumerable: desc.enumerable,
                    get: desc.get,
                    set: wrappedSet
                });
            }
        }
        if (typeof Element !== "undefined" && Element.prototype.setAttribute && !Element.prototype.setAttribute._waifuNormalizeUrl) {
            var origSA = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function (name, value) {
                if (typeof name === "string" && name.toLowerCase() === "src" && typeof value === "string") {
                    value = normalizeAssetUrl(value);
                }
                return origSA.call(this, name, value);
            };
            Element.prototype.setAttribute._waifuNormalizeUrl = true;
        }
    })();

    (function patchLive2dHitTestSafe() {
        if (typeof window === "undefined") return;
        ["Live2DModelWebGL", "Live2DModelJS"].forEach(function (name) {
            var Ctor = window[name];
            if (!Ctor || !Ctor.prototype || typeof Ctor.prototype.hitTestSimpleCustom !== "function") return;
            var orig = Ctor.prototype.hitTestSimpleCustom;
            if (orig._waifuPatchedHitTest) return;
            Ctor.prototype.hitTestSimpleCustom = function (t, i, e, r) {
                if (t == null || i == null || t.length < 2 || i.length < 2) return false;
                return orig.call(this, t, i, e, r);
            };
            Ctor.prototype.hitTestSimpleCustom._waifuPatchedHitTest = true;
        });
    })();

    (function waifuWrapLoadlive2dDisposeBeforeInit() {
        var origLd = window.loadlive2d;
        if (typeof origLd !== "function" || origLd._waifuDisposeBeforeInit) return;
        window.loadlive2d = function (canvasId, modelUrl, headPos) {
            try {
                if (window.Live2D && typeof window.Live2D.dispose === "function") window.Live2D.dispose();
            } catch (eLd) {}
            return origLd.call(this, canvasId, modelUrl, headPos);
        };
        window.loadlive2d._waifuDisposeBeforeInit = true;
    })();

    (function patchLive2dWebGLUpdateDrawWhenGlobalsDisposed() {
        function waifuLive2dMoc2SkipFrameBecauseDisposed() {
            try {
                var L = window.Live2D;
                if (!L) return true;
                var fb = L.frameBuffers,
                    gl = L.glContext;
                if (!Array.isArray(fb) || !Array.isArray(gl)) return false;
                return fb.length === 0 || gl.length === 0;
            } catch (e) {
                return true;
            }
        }
        var ctor = window.Live2DModelWebGL;
        if (!ctor || !ctor.prototype || ctor.prototype._waifuPatchedMoc2GlGuard) return;
        if (typeof ctor.prototype.update === "function") {
            var origUp = ctor.prototype.update;
            ctor.prototype.update = function () {
                if (waifuLive2dMoc2SkipFrameBecauseDisposed()) return;
                return origUp.apply(this, arguments);
            };
        }
        if (typeof ctor.prototype.draw === "function") {
            var origDr = ctor.prototype.draw;
            ctor.prototype.draw = function () {
                if (waifuLive2dMoc2SkipFrameBecauseDisposed()) return;
                return origDr.apply(this, arguments);
            };
        }
        ctor.prototype._waifuPatchedMoc2GlGuard = true;
    })();
})(window.WaifuKit = window.WaifuKit || {});

/**
 * 与 model_list.json / API 槽位相关的 key 解析
 */
(function (W) {
    W.apiModel = {
        getSlot: function (apiModels, modelId) {
            if (!apiModels) return null;
            var mid = parseInt(modelId, 10);
            if (!mid || mid < 1) return null;
            return apiModels[mid - 1];
        },
        resolveKey: function (apiModels, modelId, modelTexturesId) {
            var entry = W.apiModel.getSlot(apiModels, modelId);
            if (entry == null) return null;
            var tid = parseInt(modelTexturesId, 10) || 0;
            if (Array.isArray(entry)) return tid > 0 ? entry[tid - 1] : entry[0];
            return entry;
        },
        isMoc3Key: function (k) {
            if (typeof k !== "string") return false;
            return k.indexOf("live2d_moc3/") === 0 || k.indexOf("moc3/") === 0;
        },
        pickRandTextureIdInSlot: function (slot, currentTexturesId) {
            if (!Array.isArray(slot) || slot.length <= 1) return null;
            var cur = parseInt(currentTexturesId, 10) || 0;
            if (cur === 0) cur = 1;
            var newId = cur,
                tries = 0;
            while (newId === cur && tries < 64) {
                newId = Math.floor(Math.random() * slot.length) + 1;
                tries++;
            }
            return newId === cur ? null : newId;
        }
    };
})(window.WaifuKit = window.WaifuKit || {});

/**
 * MOC3：Pixi + cubism4，状态挂在本模块闭包
 */
(function (W) {
    var moc3App = null;
    var moc3Model = null;
    var moc3WindowFocusHandler = null;

    var MOC3_PARAM_ID_ROWS = [
        ["idParamAngleX", ["ParamAngleX", "PARAM_ANGLE_X"]],
        ["idParamAngleY", ["ParamAngleY", "PARAM_ANGLE_Y"]],
        ["idParamAngleZ", ["ParamAngleZ", "PARAM_ANGLE_Z"]],
        ["idParamEyeBallX", ["ParamEyeBallX", "PARAM_EYE_BALL_X"]],
        ["idParamEyeBallY", ["ParamEyeBallY", "PARAM_EYE_BALL_Y"]],
        ["idParamBodyAngleX", ["ParamBodyAngleX", "PARAM_BODY_ANGLE_X"]],
        ["idParamBreath", ["ParamBreath", "PARAM_BREATH"]]
    ];
    var MOC3_BREATH_PEAK_MULTIPLIER = 5;

    function resolveIdleMotionGroup(settingsJson) {
        var motions = settingsJson && settingsJson.FileReferences && settingsJson.FileReferences.Motions;
        if (!motions || typeof motions !== "object") return "Idle";
        if ("Idle" in motions) return "Idle";
        if ("idle" in motions) return "idle";
        var keys = Object.keys(motions);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var list = motions[k];
            if (Array.isArray(list) && list.length) return k;
        }
        return "Idle";
    }

    function patchFocusAfterLoadParameters(m) {
        var im = m && m.internalModel;
        var cm = im && im.coreModel;
        if (!im || !cm || im._waifuPatchedFocusAfterLoad) return;
        if (typeof im.updateFocus !== "function" || typeof cm.loadParameters !== "function") return;
        var origLoad = cm.loadParameters.bind(cm);
        cm.loadParameters = function () {
            origLoad();
            im.updateFocus();
        };
        im._waifuPatchedFocusAfterLoad = true;
    }

    function tryPatchFocusAfterLoadParameters(m, attempt) {
        attempt = attempt || 0;
        patchFocusAfterLoadParameters(m);
        var im = m && m.internalModel;
        if (!im || !im._waifuPatchedFocusAfterLoad) {
            if (attempt < 90) requestAnimationFrame(function () {
                tryPatchFocusAfterLoadParameters(m, attempt + 1);
            });
        }
    }

    function alignCubismParameterIds(model) {
        var im = model && model.internalModel;
        if (!im || im._waifuCubismIdsAligned) return;
        var ids = im.coreModel && im.coreModel._parameterIds;
        if (!ids || !ids.length) return;

        function pick(cands) {
            for (var i = 0; i < cands.length; i++) {
                if (ids.indexOf(cands[i]) !== -1) return cands[i];
            }
            return null;
        }
        for (var r = 0; r < MOC3_PARAM_ID_ROWS.length; r++) {
            var row = MOC3_PARAM_ID_ROWS[r];
            var id = pick(row[1]);
            if (id) im[row[0]] = id;
        }
        im._waifuCubismIdsAligned = true;
        try {
            var bp = im.breath && typeof im.breath.getParameters === "function" && im.breath.getParameters();
            if (bp && bp.length >= 5 && im.idParamAngleX && im.idParamAngleY && im.idParamAngleZ && im.idParamBodyAngleX && im.idParamBreath) {
                bp[0].parameterId = im.idParamAngleX;
                bp[1].parameterId = im.idParamAngleY;
                bp[2].parameterId = im.idParamAngleZ;
                bp[3].parameterId = im.idParamBodyAngleX;
                bp[4].parameterId = im.idParamBreath;
            }
        } catch (eBr) {}
    }

    function applyBreathTuning(model) {
        var k = MOC3_BREATH_PEAK_MULTIPLIER;
        if (!isFinite(k) || k <= 0 || k === 1) return;
        var im = model && model.internalModel;
        var breath = im && im.breath;
        var bp = breath && typeof breath.getParameters === "function" && breath.getParameters();
        if (!bp || !bp.length) return;
        for (var i = 0; i < bp.length; i++) {
            var p = bp[i];
            if (p != null && typeof p.peak === "number") p.peak *= k;
        }
    }

    function removePointerListeners() {
        if (moc3WindowFocusHandler) {
            window.removeEventListener("mousemove", moc3WindowFocusHandler);
            moc3WindowFocusHandler = null;
        }
    }

    async function ensureCubism4Runtime() {
        if (window.__waifuCubism4Ready) return;
        var base = W.getScriptBase();
        if (!base) {
            var el = document.querySelector('script[src*="waifu-app"]');
            if (el && el.src) base = new URL(".", el.src).href;
        }
        if (!base) throw new Error("WaifuKit: 未设置 scriptBase，请在 init 传入 assetBase");
        await W.loadScriptOnce(base + "live2dcubismcore.min.js");
        if (!window.Live2DCubismCore) throw new Error("Live2DCubismCore 未加载");
        await W.loadScriptOnce(base + "pixi.min.js");
        if (!window.PIXI) throw new Error("PixiJS 未加载");
        await W.loadScriptOnce(base + "cubism4.min.js");
        if (!window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) throw new Error("pixi-live2d-display Cubism4 未就绪");
        window.__waifuCubism4Ready = true;
    }

    W.moc3Runtime = {
        destroy: async function () {
            removePointerListeners();
            if (moc3Model) {
                try {
                    if (moc3App && moc3App.stage) moc3App.stage.removeChild(moc3Model);
                    moc3Model.destroy({
                        children: true,
                        texture: true
                    });
                } catch (e) {}
                moc3Model = null;
            }
            if (moc3App) {
                try {
                    moc3App.ticker.stop();
                    moc3App.destroy(false, {
                        children: true,
                        texture: true
                    });
                } catch (e2) {}
                moc3App = null;
            }
        },

        load: async function (json) {
            await W.moc3Runtime.destroy();
            try {
                if (window.Live2D && typeof window.Live2D.dispose === "function") window.Live2D.dispose();
            } catch (e) {}
            await ensureCubism4Runtime();
            var canvas = document.getElementById("live2d");
            if (!canvas) throw new Error("找不到 #live2d 画布");
            var idleMotionGroup = resolveIdleMotionGroup(json);
            moc3App = new PIXI.Application({
                view: canvas,
                width: canvas.width,
                height: canvas.height,
                backgroundAlpha: 0,
                antialias: true,
                resolution: 1,
                autoDensity: false,
                sharedTicker: true
            });
            if (moc3App.view && moc3App.view.style) {
                var vs = moc3App.view.style;
                vs.removeProperty("width");
                vs.removeProperty("height");
                vs.removeProperty("max-width");
                vs.removeProperty("cursor");
                vs.removeProperty("touch-action");
            }
            var ixPl = moc3App.renderer && moc3App.renderer.plugins && moc3App.renderer.plugins.interaction;
            if (ixPl && typeof ixPl.setCursorMode === "function") {
                var origSetCursorMode = ixPl.setCursorMode.bind(ixPl);
                ixPl.setCursorMode = function (mode) {
                    origSetCursorMode(mode);
                    var el = ixPl.interactionDOMElement;
                    if (el && el.style) el.style.removeProperty("cursor");
                };
            }
            moc3Model = await PIXI.live2d.Live2DModel.from(json, {
                ticker: moc3App.ticker,
                idleMotionGroup: idleMotionGroup,
                autoUpdate: true,
                autoInteract: false
            });
            alignCubismParameterIds(moc3Model);
            applyBreathTuning(moc3Model);
            moc3App.stage.addChild(moc3Model);
            var mw = moc3Model.width || 1,
                mh = moc3Model.height || 1;
            var sc = Math.min(canvas.width / mw, canvas.height / mh) * 1.3;
            moc3Model.scale.set(sc);
            moc3Model.anchor.set(0.5, 0.5);
            moc3Model.position.set(canvas.width / 2, canvas.height / 2);
            moc3Model.interactive = true;
            moc3App.stage.interactive = true;
            if (ixPl && typeof moc3Model.registerInteraction === "function") moc3Model.registerInteraction(ixPl);
            tryPatchFocusAfterLoadParameters(moc3Model);
            var moc3FocusWorkPt = new PIXI.Point();
            moc3WindowFocusHandler = function (ev) {
                if (!moc3Model || !moc3App) return;
                try {
                    if (typeof moc3Model.updateTransform === "function") moc3Model.updateTransform();
                } catch (eTf) {}
                if (ixPl && typeof ixPl.mapPositionToPoint === "function") {
                    ixPl.mapPositionToPoint(moc3FocusWorkPt, ev.clientX, ev.clientY);
                    moc3Model.focus(moc3FocusWorkPt.x, moc3FocusWorkPt.y);
                    return;
                }
                var v = moc3App.view;
                if (!v) return;
                var rect = v.getBoundingClientRect();
                var rw = moc3App.renderer.width,
                    rh = moc3App.renderer.height;
                if (rect.width <= 0 || rect.height <= 0) return;
                var x = (ev.clientX - rect.left) * (rw / rect.width),
                    y = (ev.clientY - rect.top) * (rh / rect.height);
                moc3Model.focus(Math.max(0, Math.min(rw, x)), Math.max(0, Math.min(rh, y)));
            };
            window.addEventListener("mousemove", moc3WindowFocusHandler, {
                passive: true
            });
            var motionsRef = json.FileReferences && json.FileReferences.Motions;
            moc3Model.on("pointertap", function () {
                if (motionsRef && motionsRef.TapBody) {
                    moc3Model.motion("TapBody").catch(function () {});
                    return;
                }
                if (motionsRef && motionsRef.Tap) {
                    moc3Model.motion("Tap").catch(function () {});
                    return;
                }
                moc3Model.motion(idleMotionGroup).catch(function () {});
            });
            try {
                await moc3Model.motion(idleMotionGroup);
            } catch (e3) {}
        },

        capturePhoto: function () {
            if (!moc3App || !moc3App.renderer || !moc3App.stage) return false;
            try {
                var r = moc3App.renderer;
                r.render(moc3App.stage);
                var extract = r.extract != null ? r.extract : r.plugins && r.plugins.extract;
                var dataUrl = "";
                if (extract && typeof extract.base64 === "function") {
                    dataUrl = extract.base64(moc3App.stage, "image/png", 1);
                    if (dataUrl && dataUrl.indexOf("data:") !== 0) dataUrl = "data:image/png;base64," + dataUrl;
                } else if (extract && typeof extract.canvas === "function") {
                    var cv = extract.canvas(moc3App.stage);
                    if (cv && typeof cv.toDataURL === "function") dataUrl = cv.toDataURL("image/png");
                }
                if (!dataUrl && moc3App.view && typeof moc3App.view.toDataURL === "function") dataUrl = moc3App.view.toDataURL("image/png");
                if (!dataUrl || dataUrl.length < 32) return false;
                var a = document.createElement("a");
                a.setAttribute("type", "hidden");
                a.href = dataUrl;
                a.download = "photo.png";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return true;
            } catch (ePh) {
                return false;
            }
        },

        isLoaded: function () {
            return !!moc3App;
        }
    };
})(window.WaifuKit = window.WaifuKit || {});
