'use strict'

const box = require('mp4-box-encoding')

function read(file) {
  const boxes = []

  // bug with reading `ftype` atom in mp4-box-encoding
  while (file.length) {
    const tmp = box.readHeaders(file)

    boxes.push( box.decode(file.slice(0, tmp.length)) )
    file = file.slice(tmp.length)
  }

  return boxes
}

function write(boxes) {
  return Buffer.concat( boxes.map(xbox => box.encode(xbox)) )
}

function thrower() {
  throw new Error('Incompatible mp4 file')
}

function safe_stco(trak) {
  try {
    return trak.mdia.minf.stbl.stco
  } catch(e) {
    thrower()
  }
}

function patch_stco(moov, patch) {
  if (!moov.traks.length) {
    thrower()
  }

  const size = moov.length

  for(const track of moov.traks) {
    const stco = safe_stco(track)

    stco.entries = stco.entries.map(offset => patch(offset, size))
  }
}

function after(offset, size) {
  return offset - size
}

function before(offset, size) {
  return offset + size
}

function box_pos(boxes, name) {
  for(let i = 0; i < boxes.length; ++i) {
    if (boxes[i].type == name) {
      return i
    }
  }

  return -1
}

/**
 * move `moov` before `mdat`
 * @param file {Buffer}
 * @returns {Buffer}
 */
exports.before = function (file) {
  const boxes = read(file)

  const p_moov = box_pos(boxes, 'moov')
  const p_mdat = box_pos(boxes, 'mdat')

  if (p_moov == -1 || p_mdat == -1) {
    thrower()
  }

  if ( p_moov < p_mdat ) { return file }  // copy?

  const moov = boxes[p_moov]
  const mdat = boxes[p_mdat]

  boxes[p_mdat] = moov
  boxes[p_moov] = mdat

  patch_stco(moov, before)
  return write(boxes)
}

/**
 * move `moov` after `mdat`
 * @param file {Buffer}
 * @returns {Buffer}
 */
exports.after = function (file) {
  const boxes = read(file)

  const p_moov = box_pos(boxes, 'moov')
  const p_mdat = box_pos(boxes, 'mdat')

  if (p_moov == -1 || p_mdat == -1) {
    thrower()
  }

  if ( p_moov > p_mdat ) { return file }  // copy?

  const moov = boxes[p_moov]

  boxes[p_moov] = boxes[p_mdat]
  boxes[p_mdat] = moov

  patch_stco(moov, after)
  return write(boxes)
}
