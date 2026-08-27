
var express = require('express')
var dataSource = require("../typeorm-db");

var router = express.Router()
module.exports = router

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

router.get('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    // hard-coded getting account id of 1
    // as a rpelacement to getting this from the session and such
    // (just imagine that we implemented auth, etc)
    const results = await repo.find({ where: { id: 1 } })

    console.log(results)

    return res.json(results)
  } catch (err) {
    return next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    // Only accept scalar strings: an object here (e.g. an address carrying a
    // "__proto__" key) reaches TypeORM's internal merge and pollutes
    // Object.prototype, which then leaks into every subsequent `where` clause.
    if (!isNonEmptyString(req.body.name) || !isNonEmptyString(req.body.address) || !isNonEmptyString(req.body.role)) {
      return res.status(400).json({ error: 'name, address and role must be strings' })
    }

    const user = {
      name: req.body.name,
      address: req.body.address,
      role: req.body.role
    }

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    return next(err)
  }
})