var SHADOW_VSHADER_SOURCE = [
    'attribute vec4 a_Position;',
    'uniform mat4 u_MvpMatrix;',
    'void main() {',
        'gl_Position = u_MvpMatrix * a_Position;',
    '}'
].join('');

var SHADOW_FSHADER_SOURCE = [
    'precision mediump float;',
    'void main() {',
        'const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);',
        'const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);',
        'vec4 rgbaDepth = fract(gl_FragCoord.z * bitShift);',
        'rgbaDepth -= rgbaDepth.gbaa * bitMask;',
        'gl_FragColor = rgbaDepth;',
    '}'
].join('');

var VSHADER_SOURCE = [
    'attribute vec4 a_Position;',
    'uniform mat4 u_MvpMatrix;',
    'uniform mat4 u_MvpMatrixFromLight;',
    'varying vec4 v_PositionFromLight;',
    'void main() {',
        'gl_Position = u_MvpMatrix * a_Position;',
        'v_PositionFromLight = u_MvpMatrixFromLight * a_Position;',
    '}'
].join('');

var FSHADER_SOURCE = [
    'precision highp float;',
    'uniform sampler2D u_ShadowMap;',
    'varying vec4 v_PositionFromLight;',
    'float unpackDepth(const in vec4 rgbaDepth) {',
        'const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0 * 256.0), 1.0/(256.0*256.0*256.0));',
        'float depth = dot(rgbaDepth, bitShift);',
        'return depth;',
    '}',
    'void main() {',
        'vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;',
        'vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);',
        'float depth = unpackDepth(rgbaDepth);',
        'float visibility = (shadowCoord.z > depth + 0.0015) ? 0.7 : 1.0;',
        'gl_FragColor = vec4(vec3(1.0, 0.0, 0.0) * visibility, 1.0);',
    '}'
].join('');

var OFFSCREEN_WIDTH = 2048;
var OFFSCREEN_HEIGHT = 2048;
var LIGHT = [0, 7, 2];

function main() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var canvas = document.getElementById('webgl');
    canvas.width = width;
    canvas.height = height;

    var gl = getWebGLContext(canvas);
    if (!gl) {
        console.error('Failed to get the rendering context for WebGL');
        return;
    }

    var shadowProgram = createProgram(gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
    shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
    shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');

    var normalProgram = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    normalProgram.a_Position = gl.getAttribLocation(normalProgram, 'a_Position');
    normalProgram.u_MvpMatrix = gl.getUniformLocation(normalProgram, 'u_MvpMatrix');
    normalProgram.u_MvpMatrixFromLight = gl.getUniformLocation(normalProgram, 'u_MvpMatrixFromLight');
    normalProgram.u_ShadowMap = gl.getUniformLocation(normalProgram, 'u_ShadowMap');

    var triangle = initVertexBuffersForTriangle(gl);
    var sphere = initVertexBuffersForSphere(gl);

    var fbo = initFramebufferObject(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture);

    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);

    var viewProjMatrixFromLight = new Matrix4();
    viewProjMatrixFromLight.setPerspective(70.0, OFFSCREEN_WIDTH/OFFSCREEN_HEIGHT, 1.0, 200.0);
    viewProjMatrixFromLight.lookAt(LIGHT[0], LIGHT[1], LIGHT[2], 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

    var viewProjMatrix = new Matrix4();
    viewProjMatrix.setPerspective(45, canvas.width/canvas.height, 1.0, 100.0);
    viewProjMatrix.lookAt(0.0, 7.0, 9.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

    var currentAngle = 0.0;
    var mvpMatrixFromLight_t = new Matrix4();
    var mvpMatrixFromLight_p = new Matrix4();

    var tick = function() {
        currentAngle = animate(currentAngle);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, OFFSCREEN_HEIGHT, OFFSCREEN_HEIGHT);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(shadowProgram);
        drawTriangle(gl, shadowProgram, triangle, currentAngle, viewProjMatrixFromLight);
        mvpMatrixFromLight_t.set(g_mvpMatrix);
        drawSphere(gl, shadowProgram, sphere, viewProjMatrixFromLight);
        mvpMatrixFromLight_p.set(g_mvpMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(normalProgram);
        gl.uniform1i(normalProgram.u_ShadowMap, 0);

        gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
        drawTriangle(gl, normalProgram, triangle, currentAngle, viewProjMatrix);
        gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_p.elements);
        drawSphere(gl, normalProgram, sphere, viewProjMatrix);

        window.requestAnimationFrame(tick, canvas);
    };
    tick();
}

var g_modelMatrix = new Matrix4();
var g_mvpMatrix = new Matrix4();
function drawTriangle(gl, program, triangle, angle, viewProjMatrix) {
    g_modelMatrix.setRotate(angle, 0, 1, 0);
    draw(gl, program, triangle, viewProjMatrix);
}

function drawSphere(gl, program, sphere, viewProjMatrix) {
    g_modelMatrix.setScale(4.0, 4.0, 4.0);
    g_modelMatrix.translate(0.0, -2.0, 0.0);
    draw(gl, program, sphere, viewProjMatrix);
}

function draw(gl, program, o, viewProjMatrix) {
    initAttributeVariable(gl, program.a_Position, o.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);
    g_mvpMatrix.set(viewProjMatrix);
    g_mvpMatrix.multiply(g_modelMatrix);
    gl.uniformMatrix4fv(program.u_MvpMatrix, false, g_mvpMatrix.elements);
    gl.drawElements(gl.TRIANGLES, o.numIndices, gl.UNSIGNED_BYTE, 0);
}

function initAttributeVariable(gl, a_attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initVertexBuffersForTriangle(gl) {
    var vertices = new Float32Array([
        -0.8, 3.5, 0.0,
         0.8, 3.5, 0.0,
         0.0, 3.5, 1.8
    ]);
    var indices = new Uint8Array([0, 1, 2]);
    return {
        vertexBuffer: initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT),
        indexBuffer: initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE),
        numIndices: indices.length
    };
}

function initVertexBuffersForSphere(gl) {
    var SPHERE_DIV = 20;
    var i, ai, si, ci,
        j, aj, sj, cj,
        p1, p2;

    var vertices = [];
    var indices = [];

    for(j = 0; j <= SPHERE_DIV; j++) {
        aj = j * Math.PI / SPHERE_DIV;
        sj = Math.sin(aj);
        cj = Math.cos(aj);
        for(i = 0; i <= SPHERE_DIV; i++) {
            ai = i * 2 * Math.PI / SPHERE_DIV;
            si = Math.sin(ai);
            ci = Math.cos(ai);
            vertices.push(si * sj);
            vertices.push(cj);
            vertices.push(ci * sj);
        }
    }
    for(j = 0; j < SPHERE_DIV; j++) {
        for(i = 0; i < SPHERE_DIV; i++) {
            p1 = j * (SPHERE_DIV+1) + i;
            p2 = p1 + (SPHERE_DIV+1);

            indices.push(p1);
            indices.push(p2);
            indices.push(p1 + 1);

            indices.push(p1 + 1);
            indices.push(p2);
            indices.push(p2 + 1);
        }
    }
    return {
        vertexBuffer: initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT),
        indexBuffer: initElementArrayBufferForLaterUse(gl, new Uint8Array(indices), gl.UNSIGNED_BYTE),
        numIndices: indices.length
    };
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    buffer.num = num;
    buffer.type = type;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}

function initElementArrayBufferForLaterUse(gl, indices, type) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    buffer.type = type;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return buffer;
}

function initFramebufferObject(gl) {
    var texture, depthBuffer;
    var framebuffer = gl.createFramebuffer();

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    framebuffer.texture = texture;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return framebuffer;
}

var ANGLE_STEP = 40;
var last = Date.now();
function animate(angle) {
    var now = Date.now();
    var elapsed = now - last;
    last = now;
    var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
    return newAngle % 360;
}
