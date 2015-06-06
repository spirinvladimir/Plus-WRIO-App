var Reflux = require('reflux'),
    request = require('superagent'),
    Actions = require('../actions/jsonld'),
    uuid = require('uuid');

module.exports = Reflux.createStore({
    listenables: Actions,
    getUrl: function () {
        var host = (process.env.NODE_ENV === 'development') ? 'http://localhost:3000/' : 'http://wrio.s3-website-us-east-1.amazonaws.com/',
            theme = 'Default-WRIO-Theme';
        return host + theme + '/widget/defaultList.htm';
    },
    init: function () {
        this.getHttp(
            this.getUrl(),
            this.core
        );
    },
    data: {},
    pending: 0,
    onData: function (o, name) {
        if (name) {
            if (this.data[name] === undefined) {
                this.data[name] = [];
            }
            this.data[name].push(o);
        } else {
            if (o.author) {
                console.warn('plus: author [' + o.author + '] do not have type Article');
            }
            name = uuid.v1();
            this.data[name] = o;
        }
        this.pending -= 1;
        if (this.pending === 0) {
            this.trigger(this.data);
        }
    },
    getHttp: function (url, cb) {
        request.get(
            url,
            function (err, result) {
                if (!err) {
                    var e = document.createElement('div');
                    e.innerHTML = result.text;
                    result = Array.prototype.map.call(e.getElementsByTagName('script'), function (el) {
                        return JSON.parse(el.innerText);
                    });
                }
                cb.call(this, result || []);
            }.bind(this)
        );
    },
    core: function (jsons) {
        var i, json;
        for (i = 0; i < jsons.length; i += 1) {
            json = jsons[i];
            if (json.itemListElement) {
                this.pending += json.itemListElement.length;
                json.itemListElement.forEach(function (o) {
                    o = {
                        name: o.name,
                        url: o.url,
                        author: o.author
                    };
                    var author = o.author;
                    if (author) {
                        this.getHttp(author, function (jsons) {
                            var i, name;
                            for (i = 0; i < jsons.length; i += 1) {
                                if (json[i]['@type'] === 'Article') {
                                    name = json[i].name;
                                    i = jsons.length;
                                }
                            }
                            this.onData(o, name);
                        }.bind(this));
                    } else {
                        this.onData(o);
                    }
                }, this);
            }
        }
    },
    getInitialState: function () {
        return this.data;
    },
    onRead: function (url) {
        this.trigger(this.data);
    }
});
