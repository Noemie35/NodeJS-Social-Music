var express = require('express');
var _ = require('lodash');
var router = express.Router();
var SongService = require('../services/songs');
var NoteService = require('../services/notes');
var UsersService = require('../services/users');

var verifyIsAdmin = function(req, res, next) {
    if (req.isAuthenticated() && req.user.username === 'admin') {
        return next();
    }
    else {
        res.status(403).send({err: 'Current user can not access to this operation'});
    }
};

router.get('/', function(req, res) {
    if (req.accepts('text/html') || req.accepts('application/json')) {

        var keys = ["title", "album", "artist", "year", "bpm"];
        var params = {};

        keys.forEach(function(key) {
            if (req.query[key]) {
                params[key] = req.query[key];
            }
        })

        SongService.find(params)
            .then(function(songs) {
                if (req.accepts('text/html')) {
                    return res.render('songs', {songs: songs});
                }
                if (req.accepts('application/json')) {
                    res.status(200).send(songs);
                }
            })
        ;
    }
    else {
        res.status(406).send({err: 'Not valid type for asked ressource'});
    }
});

router.get('/add', function(req, res) {
    var song = (req.session.song) ? req.session.song : {};
    var err = (req.session.err) ? req.session.err : null;
    if (req.accepts('text/html')) {
        req.session.song = null;
        req.session.err = null;
        return res.render('newSong', {song: song, err: err});
    }
    else {
        res.status(406).send({err: 'Not valid type for asked ressource'});
    }
});

router.get('/:id', function(req, res) {
    if (req.accepts('text/html') || req.accepts('application/json')) {
        SongService.findOneByQuery({_id: req.params.id})
            .then(function(song) {
                if (!song) {
                    res.status(404).send({err: 'No song found with id' + req.params.id});
                    return;
                }
                if (req.accepts('text/html')) {
                    var note = { username: req.user.username, song: song._id, };
                    NoteService.notes().findOne(note, function(err, userNote) {
                            var Vote = (req.user.favoriteSongs.indexOf(String(song._id)) >= 0);
                            res.render('song', {song: song, note: userNote, Vote: Vote});
                        }
                    );
                    return;
                }
                if (req.accepts('application/json')) {
                    res.status(200).send(song);
                    return;
                }
            })
            .catch(function(err) {
                console.log(err);
                return res.status(500).send(err);
            })
        ;
    }
    else {
        res.status(406).send({err: 'Not valid type for asked ressource'});
    }
});

router.get('/artist/:artist', function(req, res) {
    SongService.find({artist: {$regex: req.params.artist, $options: 'i'}})
        .then(function(songs) {
            res.status(200).send(songs);
        })
        .catch(function(err) {
            console.log(err);
            res.status(500).send(err);
        })
    ;
});

var songBodyVerification = function(req, res, next) {
    var attributes = _.keys(req.body);
    var mandatoryAttributes = ['title', 'album', 'artist'];
    var missingAttributes = _.difference(mandatoryAttributes, attributes);
    if (missingAttributes.length) {
        res.status(400).send({err: missingAttributes.toString()});
    }
    else {
        if (req.body.title && req.body.album && req.body.artist) {
            next();
        }
        else {
            var error = mandatoryAttributes.toString() + ' are mandatory';
            if (req.accepts('text/html')) {
                req.session.err = error;
                req.session.song = req.body;
                res.redirect('/songs/add');
            }
            else {
                res.status(400).send({err: error});
            }
        }
    }
};

router.post('/', verifyIsAdmin, songBodyVerification, function(req, res) {
    SongService.create(req.body)
        .then(function(song) {
            if (req.accepts('text/html')) {
                return res.redirect('/songs/' + song._id);
            }
            if (req.accepts('application/json')) {
                return res.status(201).send(song);
            }
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});

router.delete('/', verifyIsAdmin, function(req, res) {
    SongService.deleteAll()
        .then(function(songs) {
            res.status(200).send(songs);
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});

router.get('/edit/:id', verifyIsAdmin, function(req, res) {
    var song = (req.session.song) ? req.session.song : {};
    var err = (req.session.err) ? req.session.err : null;
    if (req.accepts('text/html')) {
        SongService.findOneByQuery({_id: req.params.id})
            .then(function(song) {
                if (!song) {
                    res.status(404).send({err: 'No song found with id' + req.params.id});
                    return;
                }
                return res.render('editSong', {song: song, err: err});
            })
        ;
    }
    else {
        res.status(406).send({err: 'Not valid type for asked ressource'});
    }
});

router.put('/:id', verifyIsAdmin, function(req, res) {
    SongService.updateSongById(req.params.id, req.body)
        .then(function (song) {
            if (!song) {
                res.status(404).send({err: 'No song found with id' + req.params.id});
                return;
            }
            if (req.accepts('text/html')) {
                return res.redirect('/songs/' + song._id);
            }
            if (req.accepts('application/json')) {
                res.status(200).send(song);
            }
        })
        .catch(function (err) {
            res.status(500).send(err);
        })
    ;
});

router.delete('/:id', verifyIsAdmin, function(req, res) {
    SongService.removeAsync({_id: req.params.id})
        .then(function() {
            res.status(204);
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});
router.post('/:id/note', function(req, res) {
    SongService.findOneByQuery({_id: req.params.id})
        .then(function(song) {
            if (!song) {
                res.status(404).send({err: 'No song found with id' + req.params.id});
                return;
            }
            var newNote = { username: req.user.username, song: song._id, };

            NoteService.findOneByQuery(newNote)
                .then(function(note) {
                    if (note) {
                        res.status(403).send();
                        return;
                    }
                    newNote.note = req.body.note;
                    NoteService.create(newNote)
                        .then(function(note) {
                            if (req.accepts('text/html')) {
                                return res.redirect('/songs/' + song._id);
                            }

                            if (req.accepts('application/json')) {
                                return res.status(200).send(song);
                            }
                        })
                        .catch(function(err) {
                            res.status(500).send(err);
                        })
                    ;

                })
                .catch(function(err) {
                    res.status(500).send(err);
                })
            ;
        })
        .catch(function(err) {
            console.log(err);
            res.status(500).send(err);
        })
    ;
})

router.post('/:id/favorite', function(req, res) {
    UsersService.addFavorites(req.user._id, req.params.id)
        .then(function(user) {
            if (req.accepts('text/html')) {
                return res.redirect("/songs/" + req.params.id);
            }
            if (req.accepts('application/json')) {
                res.status(201).send(user);
            }
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});

router.delete('/all/favorites', function(req, res) {
    UsersService.deleteAllFavorites(req.user._id)
        .then(function(user) {
            if (req.accepts('application/json')) {
                res.status(204).send();
            }
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});

router.delete('/:id/favorite', function(req, res) {
    UsersService.deleteFavorite(req.user._id, req.params.id)
        .then(function(user) {
            if (req.accepts('application/json')) {
                res.status(204).send();
            }
        })
        .catch(function(err) {
            res.status(500).send(err);
        })
    ;
});


module.exports = router;
