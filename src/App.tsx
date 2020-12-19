import React, { useRef, useState } from 'react';
import { css } from 'astroturf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { Route, BrowserRouter as Router, Switch } from 'react-router-dom';
import _ from 'lodash';

const classes = css`
  .app {
    display: flex;
    flex-direction: column;
  }
  .cards {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  .cardWrapper {
    margin: 10px;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 2px solid black;
    border-radius: 5px;
    width: 220px;
    height: 312px;
    box-sizing: border-box;
  }
  .print .cardPage {
    width: 8.5in;
    height: 11in;
    display: flex;
    flex-direction: column;
  }
  .print .cardRow {
    display: flex;
    flex-direction: row;
  }
  .print .cardWrapper {
    margin: 0;
    width: 2.5in;
    height: 3.5in;
  }
  .print .card {
    width: 2.5in;
    height: 3.5in;
  }
`;

interface CardDef {
  flavor: string
  rules: string[]
}

interface CardDefinition extends CardDef {
  name: string
}

const Card = (props: CardDefinition) => {
  const { name, flavor, rules } = props;
  return <div className={classes.card + ' card'}>
    <h1 className='title'>{name}</h1>
    <div className='flavor'>{flavor}</div>
    <div className='rules'>
      {rules?.map((rule, i) => <div key={i} className='rule'>{rule}</div>)}
    </div>
  </div>;
}

const CardBack = () => {
  return <div className={classes.card}>
    <div className='card-back' />
  </div>;
}

async function GenerateCanvases(refs: { [key: string]: HTMLDivElement }) {
  return await Promise.all(Object.entries(refs).map(async ([name, ref]) => {
    const canvas = await html2canvas(ref, {
      x: ref.offsetLeft, y: ref.offsetTop,
    });
    return {
      name: name,
      canvas: canvas,
    };
  }));
}

function dataURItoBlob(dataURI: string) {
  if (typeof dataURI !== 'string') {
    throw new Error('Invalid argument: dataURI must be a string');
  }
  const components = dataURI.split(',');
  var type = components[0].split(':')[1].split(';')[0],
    byteString = atob(components[1]),
    byteStringLength = byteString.length,
    arrayBuffer = new ArrayBuffer(byteStringLength),
    intArray = new Uint8Array(arrayBuffer);
  for (var i = 0; i < byteStringLength; i++) {
    intArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([intArray], {
    type: type
  });
}

export default function App() {
  const [generatingDownload, setGeneratingDownload] = useState<boolean>(false);
  const cardRefs: { current: { [key: string]: HTMLDivElement } } = useRef({});
  const generateImages = () => {
    const refs = cardRefs.current;
    if (!refs) return;
    setGeneratingDownload(true);
    GenerateCanvases(refs).then(generated => {
      const zip = new JSZip();
      generated.forEach(g => {
        zip.file(g.name + '.png', dataURItoBlob(g.canvas.toDataURL("image/png")));
      })
      zip.generateAsync({
        type: "base64"
      }).then(content => {
        const a = document.createElement('a');
        a.href = "data:application/zip;base64," + content;
        a.download = 'cards.zip';
        a.click();
        setGeneratingDownload(false);
      });
    });
  }
  const savedCardsString = window.localStorage.getItem('papertype-cards');
  let savedCards = [];
  if (savedCardsString !== null) {
    savedCards = JSON.parse(savedCardsString);
  }
  const [cards, setCards] = useState<CardDefinition[]>(savedCards);
  const cardDefUploadRef = useRef<HTMLInputElement>(null);
  const onCardDefUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files === null) return;
    const reader = new FileReader();
    reader.onload = event => {
      if (event.target === null || event.target.result === null) return;
      try {
        const cardsDict = JSON.parse(event.target.result.toString());
        const cards = Object.entries(cardsDict).map(([name, def]) => {
          return {
            name: name,
            ...def as CardDef,
          };
        });
        window.localStorage.setItem('papertype-cards', JSON.stringify(cards));
        setCards(cards);
      } catch (err) {
        alert(err);
      }
    };
    reader.readAsText(event.target.files[0]);
  };
  const savedCss = window.localStorage.getItem('papertype-css');
  const [css, setCSS] = useState<string>(savedCss || "");
  const cssUploadRef = useRef<HTMLInputElement>(null);
  const onCssUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files === null) return;
    const reader = new FileReader();
    reader.onload = event => {
      if (event.target === null || event.target.result === null) return;
      try {
        window.localStorage.setItem('papertype-css', event.target.result.toString());
        setCSS(event.target.result.toString());
      } catch (err) {
        alert(err);
      }
    };
    reader.readAsText(event.target.files[0]);
  };
  const cardDivs = cards.map(def => <div
    key={def.name}
    ref={(el: any) => cardRefs.current[def.name] = el} className={classes.cardWrapper}>
    <Card
      key={def.name}
      {...def} />
  </div>);
  const cardBack = <div className={classes.cardWrapper} ref={(el: any) => cardRefs.current['Card Back'] = el}>
    <CardBack />
  </div>;
  const allCards = cards.length === 0 ? [] : [cardBack].concat(cardDivs);
  return <Router>
    <style>{css}</style>
    <Switch>
      <Route path="/print">
        <div className={classes.app}>
          <div className={classes.cards + ' ' + classes.print}>
            {_.chunk(allCards, 9).map((group, i) => <div key={i} className={classes.cardPage}>
              {_.chunk(group, 3).map((row, j) => <div key={j} className={classes.cardRow}>{row}</div>)}
            </div>)}
          </div>
        </div>
      </Route>
      <Route path="/">
        <div className={classes.app}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1>Step 1</h1>
              <h2>Upload Card JSON</h2>
              <div><a href="https://raw.githubusercontent.com/etherealmachine/papertype/master/src/examples/scurvy_and_rum.json">Example</a></div>
              <input className="form-control-file" type="file" ref={cardDefUploadRef} onChange={onCardDefUpload} accept="application/json" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1>Step 2 (Optional)</h1>
              <h2>Upload Card CSS</h2>
              <div><a href="https://raw.githubusercontent.com/etherealmachine/papertype/master/src/examples/scurvy_and_rum.css">Example</a></div>
              <input className="form-control-file" type="file" ref={cssUploadRef} onChange={onCssUpload} accept="text/css" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h1>Step 3</h1>
              <h2>Get Your Cards</h2>
              <button className={"btn btn-primary d-flex align-items-center" + (generatingDownload ? " disabled" : "")} onClick={generateImages}>
                <span>Download PNGs</span>
                {generatingDownload && <span className="spinner-border text-light" role="status" />}
              </button>
              <div>or</div>
              <a href="/print">Printable PDF Layout</a>
            </div>
          </div>
          <div className={classes.cards}>
            {allCards}
          </div>
        </div>
      </Route>
    </Switch>
  </Router>;
}