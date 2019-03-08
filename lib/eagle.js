const xml2js = require("xml2js");
const request = require("request-promise-native");

class Eagle
{
    constructor(opts) {
        if (!("host" in opts)) {
            throw new Error("Need host in options");
        }
        if (!("username" in opts)) {
            throw new Error("Need username in options");
        }
        if (!("password" in opts)) {
            throw new Error("Need password in options");
        }
        if (!("mac" in opts)) {
            throw new Error("Need mac in options");
        }

        this.opts = opts;
        this._builder = new xml2js.Builder();
    }

    getInstantaneousDemand() {
        return new Promise((resolve, reject) => {
            this._query("get_instantaneous_demand").then(resp => {
                let data;
                try {
                    data = JSON.parse(resp);
                } catch (e) {
                    reject(e);
                    return;
                }
                const demand = parseInt(data.InstantaneousDemand.Demand);
                const multiplier = parseInt(data.InstantaneousDemand.Multiplier);
                const divisor = parseInt(data.InstantaneousDemand.Divisor);
                //console.log("?", demand * multiplier / divisor, demand, multiplier, divisor);
                resolve({ timestamp: parseInt(data.InstantaneousDemand.TimeStamp), demand: demand * multiplier / divisor });
            }).catch(err => {
                reject(err);
            });
        });
    }

    getDemandPeaks() {
        return new Promise((resolve, reject) => {
            this._query("get_demand_peaks").then(resp => {
                let data;
                try {
                    data = JSON.parse(resp);
                } catch (e) {
                    reject(e);
                    return;
                }
                resolve({
                    delivered: parseFloat(data.DemandPeaks.PeakDelivered),
                    received: Math.abs(parseFloat(data.DemandPeaks.PeakReceived))
                });
            }).catch(err => {
                reject(err);
            });
        });
    }

    getCurrentSummation() {
        return new Promise((resolve, reject) => {
            this._query("get_current_summation").then(resp => {
                let data;
                try {
                    data = JSON.parse(resp);
                } catch (e) {
                    reject(e);
                    return;
                }
                const multiplier = parseInt(data.CurrentSummation.Multiplier);
                const divisor = parseInt(data.CurrentSummation.Divisor);
                const delivered = parseInt(data.CurrentSummation.SummationDelivered);
                const received = parseInt(data.CurrentSummation.SummationReceived);
                resolve({
                    timestamp: parseInt(data.CurrentSummation.TimeStamp),
                    delivered: delivered * multiplier / divisor,
                    received: received * multiplier / divisor
                });
            }).catch(err => {
                reject(err);
            });
        });
    }

    getHistoryData(start, end, freq) {
        return new Promise((resolve, reject) => {
            const params = {};
            if (typeof start === "number") {
                if (start >= 0) {
                    params.StartTime = "0x" + (start || 0).toString(16);
                } else {
                    params.StartTime = "0x" + (this._secondsSince2000() + start).toString(16);
                }
            } else {
                params.StartTime = "0x" + (this._secondsSince2000().toString(16));
            }
            if (typeof end === "number") {
                params.EndTime = "0x" + end.toString(16);
            }
            if (typeof freq === "number") {
                params.Frequency = "0x" + freq.toString(16);
            }
            this._query("get_history_data", params).then(resp => {
                let data;
                try {
                    if (resp.substr(0, 14) === "\"HistoryData\":") {
                        resp = resp.substr(14);
                    }
                    data = JSON.parse(resp);
                } catch (e) {
                    reject(e);
                    return;
                }
                let out = [];
                if (data instanceof Array) {
                    out = data.map(e => {
                        const multiplier = parseInt(e.CurrentSummation.Multiplier);
                        const divisor = parseInt(e.CurrentSummation.Divisor);
                        const delivered = parseInt(e.CurrentSummation.SummationDelivered);
                        const received = parseInt(e.CurrentSummation.SummationReceived);
                        return {
                            timestamp: parseInt(e.CurrentSummation.TimeStamp),
                            delivered: delivered * multiplier / divisor,
                            received: received * multiplier / divisor
                        };
                    });
                }
                resolve(out);
            }).catch(err => {
                reject(err);
            });
        });
    }

    _secondsSince2000() {
        return Math.floor((new Date()).getTime() / 1000) - 946684800;
    }

    _query(name, obj) {
        const cmd = {
            Command: {
                Name: name,
                MacId: this.opts.mac,
                Format: "JSON"
            }
        };
        if (obj && typeof obj === "object") {
            for (var k in obj) {
                cmd.Command[k] = obj[k];
            }
        }

        const payload = this._builder.buildObject(cmd);
        //console.log("posting", payload);
        return request.post({
            headers: { "Content-Length": payload.length },
            url: `http://${this.opts.username}:${this.opts.password}@${this.opts.host}/cgi-bin/post_manager`,
            body: payload
        });
    }
}

module.exports = Eagle;
