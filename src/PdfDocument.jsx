import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

require('pdfjs-dist');
const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.min');
const pdfjsWorkerBlob = new Blob([pdfjsWorker]);
const pdfjsWorkerBlobURL = URL.createObjectURL(pdfjsWorkerBlob);

PDFJS.workerSrc = pdfjsWorkerBlobURL;

//require('pdfjs-dist/build/pdf.combined');
//require('pdfjs-dist/web/compatibility');

export default class PdfDocument extends React.Component {
  static propTypes = {
    content: PropTypes.string,
    binaryContent: PropTypes.shape({
      data: PropTypes.any,
    }),
    file: PropTypes.any, // Could be File object or URL string.
    loading: PropTypes.any,
    page: PropTypes.number,
    scale: PropTypes.number,
    onDocumentComplete: PropTypes.func,
    onDocumentError: PropTypes.func,
    onPageComplete: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
  };

  static defaultProps = {
    page: 1
  };

  state = {}

  constructor(props) {
    super(props);
    this.onMouseDown = this._onMouseDown.bind(this);
    this.onMouseMove = this._onMouseMove.bind(this);
    this.onMouseUp = this._onMouseUp.bind(this);
    this.onMouseWheel = this._onMouseWheel.bind(this);
  }

  componentDidMount() {
    this.container = ReactDOM.findDOMNode(this).parentNode;
    this.container.addEventListener('mousedown', this.onMouseDown, false);
    this.container.addEventListener('mousewheel', this.onMouseWheel, false);
    this.container.addEventListener('DOMMouseScroll', this.onMouseWheel, false);
    this.loadPDFDocument(this.props);
  }

  componentWillReceiveProps(newProps) {
    const { pdf } = this.state;

    // Only reload if the most significant source has changed!
    let newSource = newProps.file;
    let oldSource = newSource ? this.props.file : null;
    newSource = newSource || newProps.binaryContent;
    oldSource = newSource && !oldSource ? this.props.binaryContent : oldSource;
    newSource = newSource || newProps.content;
    oldSource = newSource && !oldSource ? this.props.content : oldSource;

    if (newSource && newSource !== oldSource &&
          ((newProps.file && newProps.file !== this.props.file) ||
          (newProps.content && newProps.content !== this.props.content))) {
      this.loadPDFDocument(newProps);
    }

    if (pdf && ((newProps.page && newProps.page !== this.props.page) ||
      (newProps.scale && newProps.scale !== this.props.scale))) {
      this.setState({ page: null });
      pdf.getPage(newProps.page).then(this.onPageComplete);
    }
  }

  componentWillUnmount() {
    const { pdf } = this.state;
    if (pdf) {
      pdf.destroy();
    }
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
  }

  onDocumentComplete = (pdf) => {
    this.setState({ pdf });
    const { onDocumentComplete } = this.props;
    if (typeof onDocumentComplete === 'function') {
      onDocumentComplete(pdf.numPages);
    }
    pdf.getPage(this.props.page).then(this.onPageComplete);
  }

  onDocumentError = (err) => {
    if (err.isCanceled && err.pdf) {
      err.pdf.destroy();
    }
    if (typeof this.props.onDocumentError === 'function') {
      this.props.onDocumentError(err);
    }
  }

  onPageComplete = (page) => {
    this.setState({ page });
    this.renderPdf();
    const { onPageComplete } = this.props;
    if (typeof onPageComplete === 'function') {
      onPageComplete(page.pageIndex + 1);
    }
  }

  getDocument = (val) => {
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
    this.documentPromise = makeCancelable(PDFJS.getDocument(val).promise);
    this.documentPromise
      .promise
      .then(this.onDocumentComplete)
      .catch(this.onDocumentError);
    return this.documentPromise;
  }

  loadPDFDocument = (props) => {
    if (props.file) {
      if (typeof props.file === 'string') {
        // Is a URL
        return this.getDocument(props.file);
      }
      // Is a File object
      const reader = new FileReader();
      reader.onloadend = () =>
        this.getDocument(new Uint8Array(reader.result));
      reader.readAsArrayBuffer(props.file);
    } else if (props.binaryContent) {
      this.getDocument(props.binaryContent);
    } else if (props.content) {
      const bytes = window.atob(props.content);
      const byteLength = bytes.length;
      const byteArray = new Uint8Array(new ArrayBuffer(byteLength));
      for (let index = 0; index < byteLength; index += 1) {
        byteArray[index] = bytes.charCodeAt(index);
      }
      this.getDocument(byteArray);
    } else {
      throw new Error('Needs a file(URL) or (base64)content. At least one needs to be provided!');
    }
  }

  renderPdf = () => {
    //console.log('containerWidth', this.state.containerWidth);
    //console.log('containerHeight', this.state.containerHeight);

    const { page } = this.state;
    if (page) {
      const containerWidth = this.container.offsetWidth;
      const containerHeight = this.container.offsetHeight;
      const { canvas } = this;
      const canvasContext = canvas.getContext('2d');
      const dpiScale = window.devicePixelRatio || 1;

      const unscaledViewport = page.getViewport(1.0);
      const ratioViewport = unscaledViewport.width / unscaledViewport.height;
      const ratioContainer = containerWidth / containerHeight;
      let scale = ratioContainer >= ratioViewport ? containerHeight / unscaledViewport.height :
        containerWidth / unscaledViewport.width;
      
      const adjustedScale = scale * dpiScale;
      this.originalScale = adjustedScale;
      const viewport = page.getViewport(adjustedScale);

      canvas.style.width = `${viewport.width / dpiScale}px`;
      canvas.style.height = `${viewport.height / dpiScale}px`;
      canvas.style.left = 0 + 'px';
      canvas.style.top = 0 + 'px';
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      this.rendering = true;
      this.renderTask = page.render({ canvasContext, viewport });
      this.renderTask.promise.then(result => {
        this.rendering = false;
      });
      this.renderTask.promise.catch(reason => {
        console.log("Rendering error:", reason);
        this.rendering = false;
      });
    }
  }

  pan(dx, dy) {
    if (this.state.page) {
      const { canvas } = this;
      canvas.style.left = (canvas.offsetLeft + dx) + 'px';
      canvas.style.top = (canvas.offsetTop + dy) + 'px';
    }
  }

  zoom(factor, cx, cy) {
    const { page } = this.state;
    if (page) {
      if (this.rendering) {
        return;
      }
      const { canvas } = this;
      const dpiScale = window.devicePixelRatio || 1;
      let scale = (1 + factor) * dpiScale;
      let newWidth = scale * canvas.offsetWidth;
      let newHeight = scale * canvas.offsetHeight;

      let rect = this.container.getBoundingClientRect();
      cx -= rect.left;
      cy -= rect.top;

      let ox = cx - this.canvas.offsetLeft;
      let oy = cy - this.canvas.offsetTop;

      let dx = factor * ox;
      let dy = factor * oy;
      this.pan(-dx, -dy);

      canvas.style.width = `${newWidth / dpiScale}px`;
      canvas.style.height = `${newHeight / dpiScale}px`;

      const canvasContext = canvas.getContext('2d');
      const viewport = page.getViewport(scale * this.originalScale);
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      this.rendering = true;
      this.renderTask = page.render({ canvasContext, viewport });
      this.renderTask.promise.then(result => {
        this.rendering = false;
      });
      this.renderTask.promise.catch(reason => {
        console.log("Rendering error:", reason);
        this.rendering = false;
      });
    }
  }

  _onMouseDown(event) {
    event.preventDefault();
    this.mouseDownAndMoved = false;

    this.mouseButton = event.button;

    this.mouseDownPos = { x: event.clientX, y: event.clientY };
    this.oldMousePos = { x: event.clientX, y: event.clientY };

    if (event.button === 0) {
      window.addEventListener('mousemove', this.onMouseMove, false);
      window.addEventListener('mouseup', this.onMouseUp, false);
    }
  }

  _onMouseMove(event) {
    event.preventDefault();

    if (this.mouseButton === 0) {
      var dx = event.clientX - this.oldMousePos.x;
      var dy = event.clientY - this.oldMousePos.y;
      if (dx !== 0 || dy !== 0) {
        this.mouseDownAndMoved = true;
        this.pan(dx, dy);
      }
    }
    this.oldMousePos.x = event.clientX;
    this.oldMousePos.y = event.clientY;
  }

  _onMouseUp(event) {
    window.removeEventListener('mousemove', this.onMouseMove, false);
    window.removeEventListener('mouseup', this.onMouseUp, false);
  }

  _onMouseWheel(event) {
    event.preventDefault();

    let deltaY = 0;
    if (event.wheelDelta) {
      deltaY = -event.wheelDelta / 120;
      if (window.opera) {
        deltaY = -deltaY;
      }
    } else if (event.detail) {
      deltaY = event.detail;
    }

    let factor = deltaY > 0 ? -0.1 : 0.1;
    this.zoom(factor, event.clientX, event.clientY);
  }

  render() {
    const { loading } = this.props;
    const { page } = this.state;
    return page ?
      <canvas
        ref={(c) => { this.canvas = c; }}
        className='ba-pdf-viewer-canvas'
      /> :
      loading || <div>Loading PDF...</div>;
  }
}

const makeCancelable = (promise) => {
  let hasCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(val => (
      hasCanceled ? reject({ isCanceled: true }) : resolve(val)
    ));
    promise.catch(error => (
      hasCanceled ? reject({ isCanceled: true }) : reject(error)
    ));
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled = true;
    },
  };
};
