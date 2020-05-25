from flask import Flask, render_template
from htmlmin.decorator import htmlmin

app = Flask(__name__, static_folder="assets")
app.jinja_env.add_extension("pypugjs.ext.jinja.PyPugJSExtension")

@htmlmin
@app.route("/")
def index():
    return render_template("index.pug")


if __name__ == "__main__":
    port = 5000
    app.run("0.0.0.0", port=port, debug=True)
